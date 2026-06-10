/**
 * Server-only broadcast helper for the admin messaging tool.
 * Never import this from a client component — it reads a server secret.
 *
 * The actual SMTP send runs in the `send-broadcast` Supabase Edge Function
 * (Deno can open raw sockets / speak SMTP; the Cloudflare Worker can't). This
 * helper just forwards the message to that function over HTTPS, gated by a
 * shared secret. See supabase/functions/send-broadcast/index.ts.
 */

export interface SendBulkParams {
  subject: string;
  html: string;
  recipients: string[];
}

export interface SendBulkResult {
  sent: number;
  failed: number;
  skipped: number;
  errors?: Array<{ email: string; error: string }>;
}

function getFunctionConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.BROADCAST_SHARED_SECRET;
  if (!supabaseUrl || !anonKey || !secret) {
    throw new Error(
      'broadcast is not configured: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, BROADCAST_SHARED_SECRET'
    );
  }
  return { url: `${supabaseUrl}/functions/v1/send-broadcast`, anonKey, secret };
}

/**
 * Sends `html` (with `subject`) to each recipient via the send-broadcast Edge
 * Function. The function dedupes, caps, paces, and reports per-recipient
 * results. Throws if the function is unreachable or returns a non-2xx status.
 */
export async function sendBulkEmail({
  subject,
  html,
  recipients,
}: SendBulkParams): Promise<SendBulkResult> {
  const { url, anonKey, secret } = getFunctionConfig();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The Supabase functions gateway expects the anon key; the shared secret
      // is the real auth gate (the function runs with verify_jwt = false).
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'x-broadcast-secret': secret,
    },
    body: JSON.stringify({ subject, html, recipients }),
  });

  const data = (await res.json().catch(() => ({}))) as SendBulkResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `broadcast function failed (${res.status})`);
  }
  return { sent: data.sent ?? 0, failed: data.failed ?? 0, skipped: data.skipped ?? 0, errors: data.errors };
}
