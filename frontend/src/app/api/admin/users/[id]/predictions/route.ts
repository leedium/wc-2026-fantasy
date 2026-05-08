import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';
import { PREDICTION_NAME_MAX, PREDICTION_NAME_REGEX } from '@/lib/constants';

interface SubmitPayload {
  tournamentId?: string;
  predictionName?: string;
  totalGoals?: number | null;
  groups?: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout?: Array<{ matchId: string; winner: string | null }>;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id: userId } = await params;
  const { supabase } = ctx;

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, lock_time')
    .eq('is_active', true)
    .maybeSingle();

  if (!tournament) {
    return NextResponse.json({ error: 'No active tournament' }, { status: 404 });
  }

  const { data: predictions } = await supabase
    .from('predictions')
    .select(
      'id, prediction_name, total_goals, submitted_at, tournament_payments(paid_at, marked_by)'
    )
    .eq('user_id', userId)
    .eq('tournament_id', tournament.id)
    .order('submitted_at', { ascending: true });

  type Pred = {
    id: string;
    prediction_name: string;
    total_goals: number | null;
    submitted_at: string | null;
    tournament_payments:
      | Array<{ paid_at: string | null; marked_by: string | null }>
      | null;
  };

  return NextResponse.json({
    tournament: { id: tournament.id, lockTime: tournament.lock_time },
    predictions: ((predictions ?? []) as Pred[]).map((p) => {
      const payment = p.tournament_payments?.[0] ?? null;
      return {
        id: p.id,
        name: p.prediction_name,
        totalGoals: p.total_goals,
        submittedAt: p.submitted_at,
        isPaid: payment != null,
        paidAt: payment?.paid_at ?? null,
        markedBy: payment?.marked_by ?? null,
      };
    }),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { id: userId } = await params;
  const body = (await request.json()) as SubmitPayload;

  if (!body.tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }
  const name = body.predictionName?.trim();
  if (!name) {
    return NextResponse.json({ error: 'predictionName is required' }, { status: 400 });
  }
  if (name.length > PREDICTION_NAME_MAX || !PREDICTION_NAME_REGEX.test(name)) {
    return NextResponse.json({ error: 'predictionName format invalid' }, { status: 400 });
  }
  if (body.totalGoals != null && (body.totalGoals < 0 || body.totalGoals > 50)) {
    return NextResponse.json({ error: 'totalGoals must be 0-50' }, { status: 400 });
  }
  if (!Array.isArray(body.groups) || !Array.isArray(body.knockout)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const payload = {
    tournament_id: body.tournamentId,
    prediction_name: name,
    total_goals: body.totalGoals,
    groups: body.groups.map((g) => ({
      group_id: g.groupId,
      first: g.first,
      second: g.second,
      third: g.third,
      fourth: g.fourth,
    })),
    knockout: body.knockout.map((k) => ({
      match_id: k.matchId,
      winner: k.winner,
    })),
  };

  const { data, error } = await ctx.supabase.rpc('admin_submit_predictions', {
    p_user_id: userId,
    payload,
  });
  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('limit reached') || msg.includes('name taken')) status = 409;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }
  return NextResponse.json({ predictionId: data });
}
