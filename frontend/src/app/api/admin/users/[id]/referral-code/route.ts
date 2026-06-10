import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';
import { REFERRAL_CODE_REGEX } from '@/lib/constants';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id]/referral-code
// Sets a user's referral code to a custom vanity value. The coarse is_admin
// gate happens here; the super-admin requirement is enforced inside the
// admin_set_referral_code RPC (which raises 'forbidden' otherwise).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { id: userId } = await context.params;

  const body = (await request.json()) as { code?: string; note?: string };
  const code = body.code?.trim().toUpperCase() ?? '';
  const note = body.note?.trim() ?? '';

  if (!REFERRAL_CODE_REGEX.test(code)) {
    return NextResponse.json({ error: 'invalid code format' }, { status: 400 });
  }
  if (!note) {
    return NextResponse.json({ error: 'note is required' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_set_referral_code', {
    p_user_id: userId,
    p_code: code,
    p_note: note,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    const status = msg.includes('forbidden')
      ? 403
      : msg.includes('user not found') || msg.includes('row missing')
        ? 404
        : msg.includes('already in use')
          ? 409
          : 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ code });
}
