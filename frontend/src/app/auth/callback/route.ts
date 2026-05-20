import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/constants';
import { signResetIntent } from '@/lib/auth/reset-intent';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  const next = searchParams.get('next') ?? ROUTES.predictions;

  const supabase = await getServerSupabase();

  if (tokenHash && rawType && (OTP_TYPES as string[]).includes(rawType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType as EmailOtpType,
    });
    if (!error) {
      // verifyOtp for signup mints a session as a side effect, overwriting
      // any existing session cookie in this browser. Email confirmation is
      // proof of ownership, not authentication: drop the just-minted session
      // and send the user to /login so they sign in explicitly. (Side effect:
      // any prior user logged into this browser is signed out — unavoidable
      // since their cookie was overwritten by verifyOtp above.)
      if (rawType === 'signup') {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?confirmed=1`);
      }
      const response = NextResponse.redirect(`${origin}${next}`);
      if (rawType === 'recovery' && data.user) {
        const intent = signResetIntent(data.user.id);
        response.cookies.set(intent.name, intent.value, intent.options);
      }
      return response;
    }
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      // Supabase Cloud's default recovery email routes through GoTrue's
      // /verify endpoint, which lands here with `code=...` instead of the
      // `token_hash`/`type=recovery` pair the local custom template uses.
      // Identify the recovery case by `next` so the reset-intent cookie
      // gets set in both flows.
      if (next === '/reset-password' && data.user) {
        const intent = signResetIntent(data.user.id);
        response.cookies.set(intent.name, intent.value, intent.options);
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}${ROUTES.login}?error=confirmation_failed`);
}
