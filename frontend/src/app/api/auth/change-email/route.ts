import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

interface ChangeEmailPayload {
  email?: unknown;
}

// Pragmatic email shape check; Supabase does the authoritative validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: ChangeEmailPayload;
  try {
    body = (await request.json()) as ChangeEmailPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.email && email === user.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'That is already your email address.' },
      { status: 400 }
    );
  }

  // With double_confirm_changes + enable_confirmations (config.toml), this
  // sends confirmation links to BOTH the current and new address; the change
  // only lands once both are clicked. Links route through /auth/callback,
  // which already verifies the `email_change` OTP type.
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=/account` }
  );

  if (error) {
    const msg = error.message ?? '';
    if (/already (registered|been registered|in use)|already exists/i.test(msg)) {
      return NextResponse.json(
        { error: 'That email address is already in use.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg || 'Could not update email.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
