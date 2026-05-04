import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id } = await params;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user?.email) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const { error: sendError } = await ctx.supabase.auth.resetPasswordForEmail(data.user.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
