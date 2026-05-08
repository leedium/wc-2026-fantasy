import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';

const USERNAME_RE = /^[A-Za-z0-9_]+$/;
const MAX_DISPLAY_NAME_LENGTH = 50;

export async function PATCH(request: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    displayName?: string | null;
  };

  const updates: Record<string, string | null> = {};

  if (body.username !== undefined) {
    const username = String(body.username).trim();
    if (username.length < 3 || username.length > 24 || !USERNAME_RE.test(username)) {
      return NextResponse.json({ error: 'username invalid format' }, { status: 400 });
    }
    updates.username = username;
  }

  if (body.displayName !== undefined) {
    if (body.displayName === null) {
      updates.display_name = null;
    } else {
      const displayName = String(body.displayName).trim();
      if (!displayName) {
        updates.display_name = null;
      } else {
        if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
          return NextResponse.json(
            { error: `displayName must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer` },
            { status: 400 }
          );
        }
        updates.display_name = displayName;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updates provided' }, { status: 400 });
  }

  // RLS allows owner-update on profiles. The DB CHECK + UNIQUE constraints
  // enforce username format/uniqueness; map common errors to friendly codes.
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

  if (error) {
    const msg = error.message ?? '';
    if (msg.toLowerCase().includes('duplicate') || msg.includes('profiles_username_key')) {
      return NextResponse.json({ error: 'username taken' }, { status: 409 });
    }
    if (msg.toLowerCase().includes('check') || msg.includes('profiles_username_format')) {
      return NextResponse.json({ error: 'username invalid format' }, { status: 400 });
    }
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
