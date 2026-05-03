import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { USERNAME_REGEX } from '@/lib/constants';

interface ForgotPasswordPayload {
  identifier?: unknown;
}

const ok = () => NextResponse.json({ ok: true }, { status: 200 });

export async function POST(request: NextRequest) {
  let body: ForgotPasswordPayload;
  try {
    body = (await request.json()) as ForgotPasswordPayload;
  } catch {
    return ok();
  }

  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  if (!identifier || identifier.length > 254) return ok();

  const isEmail = identifier.includes('@');
  let email: string | null = null;

  if (isEmail) {
    email = identifier.toLowerCase();
  } else {
    if (!USERNAME_REGEX.test(identifier)) return ok();

    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('username', identifier)
      .maybeSingle();

    if (!profile) return ok();

    const { data } = await admin.auth.admin.getUserById(profile.id);
    email = data?.user?.email ?? null;
  }

  if (email) {
    const origin = new URL(request.url).origin;
    const supabase = await getServerSupabase();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  }

  return ok();
}
