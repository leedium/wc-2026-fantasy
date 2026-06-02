import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';

interface DeleteAccountPayload {
  confirmUsername?: unknown;
}

export async function POST(request: NextRequest) {
  let body: DeleteAccountPayload;
  try {
    body = (await request.json()) as DeleteAccountPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Server-authoritative type-to-confirm: the typed value must match the
  // caller's own username (case-insensitive).
  const confirmUsername =
    typeof body.confirmUsername === 'string' ? body.confirmUsername.trim() : '';

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const username = (profile?.username as string | undefined) ?? '';
  if (!username || confirmUsername.toLowerCase() !== username.toLowerCase()) {
    return NextResponse.json(
      { error: 'username confirmation does not match' },
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc('delete_own_account');

  if (error) {
    const msg = safeMessage(error);
    const raw = error.message ?? '';
    if (raw.includes('account has paid entries')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (raw.includes('cannot delete admin account')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (raw.includes('not authenticated')) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // The auth.users row is gone; clear the now-orphaned session cookie.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
