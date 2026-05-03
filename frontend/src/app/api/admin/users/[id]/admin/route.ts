import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id } = await params;
  const body = (await request.json()) as { isAdmin?: boolean };
  if (typeof body.isAdmin !== 'boolean') {
    return NextResponse.json({ error: 'isAdmin must be a boolean' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_set_user_admin', {
    p_user_id: id,
    p_is_admin: body.isAdmin,
  });

  if (error) {
    const status = error.message.includes('cannot demote') ? 400 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
