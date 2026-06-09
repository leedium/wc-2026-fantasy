/**
 * Server-only SMTP broadcast helper for the admin messaging tool.
 * Never import this from a client component — it reads SMTP secrets and opens
 * raw sockets (same convention as lib/supabase/admin.ts).
 *
 * Runtime-aware transport:
 *  - On the Cloudflare Workers runtime (production, `npm run preview`) the Node
 *    `net` module isn't available, so we use `worker-mailer`, which speaks SMTP
 *    over the Workers `connect()` TCP socket API (ports 465/587 only; 25 blocked).
 *  - Under plain Node (`next dev`) `cloudflare:sockets` doesn't exist, so we fall
 *    back to `nodemailer`. Each is imported lazily so neither pollutes the other
 *    runtime's bundle / module graph.
 *
 * TLS model (combining SMTP_SECURE + port):
 *  - SMTP_SECURE=true (default) + port 465 ⇒ implicit TLS
 *  - SMTP_SECURE=true (default) + other port (587) ⇒ STARTTLS upgrade
 *  - SMTP_SECURE=false ⇒ plain, no TLS at all (e.g. local Mailpit)
 * Deriving STARTTLS from the port is more reliable than trusting SMTP_SECURE
 * for implicit TLS (e.g. Office 365 on 587 must STARTTLS even though "secure").
 *
 * Bulk sends are paced and hard-capped at MAX_RECIPIENTS_PER_SEND because the
 * upstream SMTP relay (GoDaddy / O365) rate-limits daily volume; the surplus is
 * reported as `skipped` rather than silently dropped. Each recipient gets an
 * individually addressed message (no shared BCC) for privacy + deliverability.
 */

const MAX_RECIPIENTS_PER_SEND = 250;
const DEFAULT_DELAY_MS = 250;

export interface SmtpConfig {
  host: string;
  port: number;
  /** Connect over TLS from the start (port 465). */
  implicitTls: boolean;
  /** Upgrade a plain connection to TLS via STARTTLS (e.g. 587). */
  startTls: boolean;
  username: string;
  password: string;
  from: string;
}

/**
 * Reads + validates the SMTP_* env vars. Throws a clear error if any required
 * value is missing — mirrors the fail-fast pattern in lib/auth/reset-intent.ts.
 * Secrets are read directly from process.env (never from config/env.ts, which
 * is for public/validated config only).
 */
export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const username = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim();

  const port = portRaw ? Number.parseInt(portRaw, 10) : NaN;

  if (!host || !username || !password || !from || !Number.isFinite(port)) {
    throw new Error(
      'SMTP is not configured: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM'
    );
  }

  // secureFlag=false ⇒ plain (no TLS). Otherwise: implicit TLS on 465, STARTTLS
  // elsewhere. SMTP_SECURE can never turn 587/25 into implicit TLS.
  const secureFlag = (process.env.SMTP_SECURE?.trim().toLowerCase() ?? 'true') !== 'false';
  const implicitTls = secureFlag && port === 465;
  const startTls = secureFlag && port !== 465;

  return { host, port, implicitTls, startTls, username, password, from };
}

export interface SendBulkParams {
  subject: string;
  html: string;
  recipients: string[];
  /** Delay between individual sends, in ms. Defaults to 250ms; pass 0 in tests. */
  delayMs?: number;
}

export interface SendBulkResult {
  /** Number of messages accepted by the SMTP server. */
  sent: number;
  /** Number of recipients the server rejected (bad address, transient error). */
  failed: number;
  /** Recipients beyond MAX_RECIPIENTS_PER_SEND that were not attempted. */
  skipped: number;
  errors: Array<{ email: string; error: string }>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** workerd sets navigator.userAgent to this; Node does not. */
function isWorkersRuntime(): boolean {
  return (
    typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
  );
}

/** Sends one message at a time over a callback, applying the cap/dedupe/pacing. */
async function sendEach(
  toSend: string[],
  delayMs: number,
  skipped: number,
  sendOne: (email: string) => Promise<void>
): Promise<SendBulkResult> {
  const result: SendBulkResult = { sent: 0, failed: 0, skipped, errors: [] };
  for (let i = 0; i < toSend.length; i++) {
    const email = toSend[i];
    try {
      await sendOne(email);
      result.sent++;
    } catch (err) {
      result.failed++;
      result.errors.push({ email, error: err instanceof Error ? err.message : 'send failed' });
    }
    if (delayMs > 0 && i < toSend.length - 1) await sleep(delayMs);
  }
  return result;
}

/**
 * Sends `html` (with `subject`) individually to each recipient over a single
 * reused SMTP connection. Resilient: one bad recipient is recorded in `errors`
 * and the batch continues. Always closes the connection before returning.
 */
export async function sendBulkEmail({
  subject,
  html,
  recipients,
  delayMs = DEFAULT_DELAY_MS,
}: SendBulkParams): Promise<SendBulkResult> {
  const config = getSmtpConfig();

  // Dedupe + normalize, then split at the daily cap.
  const unique = Array.from(
    new Set(recipients.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );
  const toSend = unique.slice(0, MAX_RECIPIENTS_PER_SEND);
  const skipped = unique.length - toSend.length;

  if (toSend.length === 0) return { sent: 0, failed: 0, skipped, errors: [] };

  if (isWorkersRuntime()) {
    // Import the ESM build explicitly. worker-mailer's `main` (CJS) does
    // `require("cloudflare:sockets")`, which esbuild emits as a CJS require that
    // throws "Dynamic require of cloudflare:sockets is not supported" at runtime
    // on workerd. The `.mjs` build uses a static `import` that workerd resolves
    // natively (paired with the cloudflare:sockets esbuild external, see
    // patches/@opennextjs+cloudflare). Lazy so it stays out of the Node build.
    const { WorkerMailer } = await import('worker-mailer/dist/index.mjs');
    const mailer = await WorkerMailer.connect({
      host: config.host,
      port: config.port,
      secure: config.implicitTls,
      startTls: config.startTls,
      credentials: { username: config.username, password: config.password },
      authType: ['plain', 'login'],
    });
    try {
      return await sendEach(toSend, delayMs, skipped, (email) =>
        mailer.send({ from: config.from, to: email, subject, html })
      );
    } finally {
      await mailer.close().catch(() => {});
    }
  }

  // Node fallback (next dev). Variable specifier keeps nodemailer out of the
  // worker bundle (the bundler can't statically follow it) and this branch never
  // runs on workerd anyway.
  const nodemailerSpecifier = 'nodemailer';
  const nodemailer = (await import(nodemailerSpecifier)).default;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.implicitTls,
    requireTLS: config.startTls,
    auth: { user: config.username, pass: config.password },
  });
  try {
    return await sendEach(toSend, delayMs, skipped, async (email) => {
      await transporter.sendMail({ from: config.from, to: email, subject, html });
    });
  } finally {
    transporter.close();
  }
}

export { MAX_RECIPIENTS_PER_SEND };
