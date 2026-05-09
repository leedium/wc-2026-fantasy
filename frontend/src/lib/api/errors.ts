/**
 * Whitelist of error substrings the API is allowed to surface to clients.
 * These are intentional, app-defined errors raised by our SECURITY DEFINER
 * RPCs and trigger functions (see supabase/migrations/*) — safe and useful
 * for the UI to render verbatim.
 *
 * Anything not on this list is treated as opaque (Postgres internals,
 * constraint names, JWT/auth library messages, etc.) and replaced with
 * a generic 'request failed' to avoid leaking schema or library details.
 */
const KNOWN_ERROR_FRAGMENTS = [
  'forbidden',
  'user not found',
  'username taken',
  'username invalid format',
  'username is required',
  'cannot delete self',
  'cannot delete admin',
  'cannot delete super admin',
  'cannot demote last admin',
  'cannot demote super admin',
  'cannot modify is_admin',
  'cannot modify is_super_admin',
  'predictions are locked',
  'not authenticated',
  'all four teams must be distinct',
  'does not belong to group',
  'winner and loser must differ',
  'prediction limit reached',
  'prediction name required',
  'prediction name taken',
  'prediction not found',
  'could not generate unique username',
  'invalid bundle group letter',
  'unknown bundle slot',
] as const;

export function safeMessage(
  error: { message?: string | null } | null | undefined
): string {
  const raw = error?.message ?? '';
  if (!raw) return 'request failed';
  const lower = raw.toLowerCase();
  for (const fragment of KNOWN_ERROR_FRAGMENTS) {
    if (lower.includes(fragment)) return raw;
  }
  console.error('[safeMessage] unmapped error:', raw);
  return 'request failed';
}
