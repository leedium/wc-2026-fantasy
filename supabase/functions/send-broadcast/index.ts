// Supabase Edge Function: send-broadcast
//
// Sends the admin broadcast email over SMTP from Deno (the Cloudflare Worker
// can't open raw sockets / bundle a socket SMTP client). The Next.js route
// calls this over HTTPS.
//
// Auth: gated by a shared secret header (`x-broadcast-secret`) that only the
// server-side Next route knows; deployed with verify_jwt = false (see
// supabase/config.toml). SMTP config + the secret come from function env
// (`supabase secrets set ...`, or --env-file for local `functions serve`).
//
// Uses a small hand-rolled SMTP client (Deno TCP/TLS) rather than a library so
// it works against a plain local sink (Mailpit, no TLS/AUTH) for local
// verification AND a real STARTTLS+AUTH server (Office 365 on 587) in prod.

const MAX_RECIPIENTS_PER_SEND = 250;
const DEFAULT_DELAY_MS = 250;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const enc = new TextEncoder();
const dec = new TextDecoder();

/** Minimal SMTP client over a single (optionally TLS-upgraded) connection. */
class Smtp {
  private conn!: Deno.Conn;
  private buf = '';
  constructor(
    private readonly host: string,
    private readonly port: number
  ) {}

  private async readReply(): Promise<{ code: number; text: string }> {
    // SMTP replies may span multiple lines: "250-foo" ... "250 bar" (space = last).
    while (true) {
      const lines = this.buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (/^\d{3} /.test(line)) {
          const consumed = lines.slice(0, i + 1).join('\r\n') + '\r\n';
          this.buf = this.buf.slice(consumed.length);
          return { code: Number.parseInt(line.slice(0, 3), 10), text: line };
        }
      }
      const chunk = new Uint8Array(4096);
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error('smtp connection closed');
      this.buf += dec.decode(chunk.subarray(0, n));
    }
  }

  private async write(s: string) {
    await this.conn.write(enc.encode(s));
  }

  private async cmd(line: string, expect: number): Promise<{ code: number; text: string }> {
    await this.write(line + '\r\n');
    const reply = await this.readReply();
    if (reply.code !== expect) {
      throw new Error(`SMTP "${line.split(' ')[0]}" got ${reply.code}: ${reply.text}`);
    }
    return reply;
  }

  private async ehlo(): Promise<string> {
    await this.write(`EHLO broadcast\r\n`);
    // Collect the full multi-line EHLO reply.
    let caps = '';
    while (true) {
      const lines = this.buf.split('\r\n');
      let done = false;
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          caps = this.buf.slice(0, this.buf.indexOf(lines[i]) + lines[i].length);
          this.buf = this.buf.slice(caps.length + 2);
          done = true;
          break;
        }
      }
      if (done) break;
      const chunk = new Uint8Array(4096);
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error('smtp connection closed during EHLO');
      this.buf += dec.decode(chunk.subarray(0, n));
    }
    return caps.toUpperCase();
  }

  async connect(opts: { implicitTls: boolean; auth?: { user: string; pass: string } }) {
    this.conn = opts.implicitTls
      ? await Deno.connectTls({ hostname: this.host, port: this.port })
      : await Deno.connect({ hostname: this.host, port: this.port });
    const greet = await this.readReply();
    if (greet.code !== 220) throw new Error(`SMTP greeting ${greet.code}: ${greet.text}`);

    let caps = await this.ehlo();

    if (!opts.implicitTls && caps.includes('STARTTLS')) {
      await this.cmd('STARTTLS', 220);
      this.conn = await Deno.startTls(this.conn, { hostname: this.host });
      this.buf = '';
      caps = await this.ehlo();
    }

    if (opts.auth) {
      if (!caps.includes('AUTH')) throw new Error('server does not advertise AUTH');
      await this.cmd('AUTH LOGIN', 334);
      await this.cmd(btoa(opts.auth.user), 334);
      await this.cmd(btoa(opts.auth.pass), 235);
    }
  }

  async sendMail(fromEmail: string, to: string, message: string) {
    await this.cmd(`MAIL FROM:<${fromEmail}>`, 250);
    await this.cmd(`RCPT TO:<${to}>`, 250);
    await this.cmd('DATA', 354);
    // Dot-stuff lines beginning with '.', terminate with <CRLF>.<CRLF>.
    const body = message.replace(/\r\n\./g, '\r\n..');
    await this.write(body + '\r\n.\r\n');
    const reply = await this.readReply();
    if (reply.code !== 250) throw new Error(`SMTP DATA got ${reply.code}: ${reply.text}`);
  }

  async quit() {
    try {
      await this.write('QUIT\r\n');
    } catch {
      // ignore
    }
    try {
      this.conn?.close();
    } catch {
      // ignore
    }
  }
}

function parseFromEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

function encodeHeaderWord(value: string): string {
  // RFC 2047 encode if the value contains non-ASCII, else send raw.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${btoa(String.fromCharCode(...enc.encode(value)))}?=`;
}

function buildMessage(from: string, to: string, subject: string, html: string, date: string): string {
  const b64 = btoa(String.fromCharCode(...enc.encode(html)));
  const wrapped = b64.replace(/(.{76})/g, '$1\r\n');
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderWord(subject)}`,
    `Date: ${date}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    '',
    wrapped,
  ].join('\r\n');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const expected = Deno.env.get('BROADCAST_SHARED_SECRET');
  if (!expected || req.headers.get('x-broadcast-secret') !== expected) {
    return json({ error: 'forbidden' }, 403);
  }

  const host = Deno.env.get('SMTP_HOST');
  const portRaw = Deno.env.get('SMTP_PORT');
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  const from = Deno.env.get('SMTP_FROM');
  const port = portRaw ? Number.parseInt(portRaw, 10) : NaN;
  if (!host || !from || !Number.isFinite(port)) {
    return json({ error: 'SMTP is not configured on the function' }, 500);
  }

  let payload: { subject?: string; html?: string; recipients?: string[]; delayMs?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const html = typeof payload.html === 'string' ? payload.html : '';
  const delayMs = typeof payload.delayMs === 'number' ? payload.delayMs : DEFAULT_DELAY_MS;
  if (!subject || !html.trim()) return json({ error: 'subject and html are required' }, 400);

  const unique = Array.from(
    new Set((payload.recipients ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))
  );
  const toSend = unique.slice(0, MAX_RECIPIENTS_PER_SEND);
  const skipped = unique.length - toSend.length;
  if (toSend.length === 0) return json({ error: 'no recipients' }, 400);

  const fromEmail = parseFromEmail(from);
  const result = {
    sent: 0,
    failed: 0,
    skipped,
    errors: [] as Array<{ email: string; error: string }>,
  };

  const smtp = new Smtp(host, port);
  try {
    await smtp.connect({
      implicitTls: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    for (let i = 0; i < toSend.length; i++) {
      const email = toSend[i];
      try {
        await smtp.sendMail(fromEmail, email, buildMessage(from, email, subject, html, new Date().toUTCString()));
        result.sent++;
      } catch (err) {
        result.failed++;
        result.errors.push({ email, error: err instanceof Error ? err.message : 'send failed' });
      }
      if (delayMs > 0 && i < toSend.length - 1) await sleep(delayMs);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'smtp connection failed', ...result }, 502);
  } finally {
    await smtp.quit();
  }

  return json(result);
});
