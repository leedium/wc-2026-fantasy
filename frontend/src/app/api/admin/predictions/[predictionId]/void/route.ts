import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

type RouteContext = { params: Promise<{ predictionId: string }> };

// PATCH /api/admin/predictions/[predictionId]/void — mark a prediction voided
// (removed from the competition + leaderboard) or restore it. Any admin; the
// admin_set_prediction_void RPC enforces the is_admin() gate and re-syncs the
// owner's referral qualification.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { predictionId } = await context.params;

  const body = (await request.json()) as { void?: boolean };

  if (typeof body.void !== 'boolean') {
    return NextResponse.json({ error: 'void must be a boolean' }, { status: 400 });
  }

  const { error } = await ctx.supabase.rpc('admin_set_prediction_void', {
    p_prediction_id: predictionId,
    p_void: body.void,
  });

  if (error) {
    const msg = error.message ?? '';
    const status = msg.includes('not found') ? 404 : msg.includes('forbidden') ? 403 : 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ voided: body.void });
}
