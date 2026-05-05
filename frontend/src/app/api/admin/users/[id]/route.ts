import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

const MAX_DISPLAY_NAME_LENGTH = 50;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    username?: string | null;
    displayName?: string | null;
  };

  if (body.username === undefined && body.displayName === undefined) {
    return NextResponse.json(
      { error: 'username or displayName is required' },
      { status: 400 }
    );
  }

  if (
    typeof body.displayName === 'string' &&
    body.displayName.length > MAX_DISPLAY_NAME_LENGTH
  ) {
    return NextResponse.json(
      { error: `displayName must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const { error } = await ctx.supabase.rpc('admin_update_profile', {
    p_user_id: id,
    p_username: body.username ?? null,
    p_display_name: body.displayName ?? null,
  });

  if (error) {
    const msg = safeMessage(error);
    if (error.message?.includes('forbidden')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (error.message?.includes('user not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (error.message?.includes('username taken')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id } = await params;

  const { error } = await ctx.supabase.rpc('admin_delete_user', { p_user_id: id });

  if (error) {
    const msg = safeMessage(error);
    const raw = error.message ?? '';
    if (raw.includes('forbidden')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (raw.includes('user not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
