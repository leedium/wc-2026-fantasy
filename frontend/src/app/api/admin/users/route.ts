import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { safeMessage } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));

  const [usersResult, tournamentResult] = await Promise.all([
    ctx.supabase.rpc('admin_list_users', {
      p_search: search,
      p_page: page,
      p_page_size: pageSize,
    }),
    ctx.supabase
      .from('tournaments')
      .select('id, lock_time')
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (usersResult.error) {
    return NextResponse.json({ error: safeMessage(usersResult.error) }, { status: 500 });
  }

  const rows = (usersResult.data ?? []) as Array<{
    id: string;
    username: string;
    email: string | null;
    is_admin: boolean;
    is_super_admin: boolean;
    prediction_count: number;
    paid_prediction_count: number;
    total_count: number;
  }>;

  return NextResponse.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email ?? null,
      isAdmin: r.is_admin,
      isSuperAdmin: r.is_super_admin,
      predictionCount: r.prediction_count,
      paidPredictionCount: r.paid_prediction_count,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
    tournament: tournamentResult.data
      ? { id: tournamentResult.data.id as string, lockTime: tournamentResult.data.lock_time as string }
      : null,
  });
}

const USERNAME_RE = /^[A-Za-z0-9_]+$/;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    username?: string;
    displayName?: string | null;
  };

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const displayName =
    typeof body.displayName === 'string' && body.displayName.trim() !== ''
      ? body.displayName.trim()
      : null;

  if (!email || !email.includes('@') || email.length > MAX_EMAIL_LENGTH) {
    return NextResponse.json({ error: 'valid email is required' }, { status: 400 });
  }
  if (!password || password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `password must be 8-${MAX_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (!username || username.length < 3 || username.length > 24 || !USERNAME_RE.test(username)) {
    return NextResponse.json({ error: 'username invalid format' }, { status: 400 });
  }
  if (displayName !== null && displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json(
      { error: `displayName must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName },
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('username taken') || msg.includes('already')) {
      return NextResponse.json({ error: 'username taken' }, { status: 409 });
    }
    if (msg.includes('username invalid format')) {
      return NextResponse.json({ error: 'username invalid format' }, { status: 400 });
    }
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id ?? null }, { status: 201 });
}
