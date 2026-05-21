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
  'prediction name required',
  'prediction name taken',
  'prediction not found',
  'could not generate unique username',
  'phase 1 ended',
  'phase 1 only fields allowed',
  // Advancers v2 (migrations 0025-0028)
  'all 8 advancers must be set',
  'advancer rank must be',
  'duplicate advancer rank',
  'duplicate advancer team',
  'advancer team',
  'advancer rank set must be',
  'not a 3rd-place team',
  'team is already assigned to',
  // R32 bracket assignment (migration 0026)
  'is not in the top-8 advancers',
  'is not a 3rd-place slot',
  'unknown r32 match',
  'all r32 3rd-place bracket slots',
  // Referrals (migration 0035)
  'no referral credits available',
  'not your prediction',
  'prediction already paid',
  'prediction_id is required',
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
