import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id } = await params;
  const tournamentId = new URL(request.url).searchParams.get('tournamentId');
  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('tournament_payments')
    .select('paid_at, marked_by')
    .eq('user_id', id)
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    paid: !!data,
    paidAt: data?.paid_at ?? null,
    markedBy: data?.marked_by ?? null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id } = await params;
  const body = (await request.json()) as {
    tournamentId?: string;
    paid?: boolean;
    paidAt?: string | null;
  };

  if (typeof body.tournamentId !== 'string' || !body.tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }
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

  const { error } = await ctx.supabase.rpc('admin_set_payment', {
    p_user_id: id,
    p_tournament_id: body.tournamentId,
    p_paid: body.paid,
    p_paid_at: paidAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ paid: body.paid, paidAt: body.paid ? paidAt : null });
}
