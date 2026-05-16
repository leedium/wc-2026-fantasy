import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  RESET_INTENT_COOKIE,
  clearResetIntentCookie,
  verifyResetIntent,
} from '@/lib/auth/reset-intent';

interface ResetPasswordPayload {
  password?: unknown;
}

export async function POST(request: NextRequest) {
  let body: ResetPasswordPayload;
  try {
    body = (await request.json()) as ResetPasswordPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cookieValue = request.cookies.get(RESET_INTENT_COOKIE)?.value;
  if (!verifyResetIntent(cookieValue, user.id)) {
    return NextResponse.json(
      { error: 'Reset link expired or invalid. Please request a new password reset email.' },
      { status: 403 }
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  const cleared = clearResetIntentCookie();
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
}
