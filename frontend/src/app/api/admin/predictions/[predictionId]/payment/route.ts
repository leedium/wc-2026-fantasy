import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';

type RouteContext = { params: Promise<{ predictionId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { predictionId } = await context.params;

  const { data, error } = await ctx.supabase
    .from('tournament_payments')
    .select('paid_at, marked_by')
    .eq('prediction_id', predictionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: safeMessage(error) }, { status: 400 });

  return NextResponse.json({
    paid: !!data,
    paidAt: data?.paid_at ?? null,
    markedBy: data?.marked_by ?? null,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { predictionId } = await context.params;

  const body = (await request.json()) as { paid?: boolean; paidAt?: string | null };

  if (typeof body.paid !== 'boolean') {
    return NextResponse.json({ error: 'paid must be a boolean' }, { status: 400 });
  }

  let paidAt: string | null = null;
  if (body.paidAt !== undefined && body.paidAt !== null) {
    const parsed = new Date(body.paidAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'paidAt must be a valid ISO timestamp' }, { status: 400 });
    }
    paidAt = parsed.toISOString();
  }

  const { error } = await ctx.supabase.rpc('admin_set_prediction_payment', {
    p_prediction_id: predictionId,
    p_paid: body.paid,
    p_paid_at: paidAt,
  });

  if (error) {
    const msg = error.message ?? '';
    const status = msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }
  return NextResponse.json({ paid: body.paid, paidAt: body.paid ? paidAt : null });
}
