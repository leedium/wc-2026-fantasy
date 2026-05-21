import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { REFERRAL_CODE_REGEX } from '@/lib/constants';

/**
 * Public endpoint used by the /register page to resolve a referral code to
 * a username for the "Invited by @user" affordance. We do the strict
 * format check before hitting the DB so the WAF rate limit catches more of
 * the noise. Anything that doesn't resolve returns `{ valid: false }` (no
 * 404), so timing attacks can't distinguish "bad format" from "unknown
 * code". Authenticated callers don't get special treatment — this is the
 * pre-signup affordance.
 *
 * Cloudflare WAF rule for production: 10 req/min/IP, Block.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase();
  if (!code || !REFERRAL_CODE_REGEX.test(code)) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('resolve_referrer_username', {
    p_code: code,
  });

  if (error) {
    // Don't surface DB internals to anon callers.
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  const username = typeof data === 'string' && data.length > 0 ? data : null;
  return NextResponse.json(
    username
      ? { valid: true, referrerUsername: username }
      : { valid: false },
    { status: 200 }
  );
}
