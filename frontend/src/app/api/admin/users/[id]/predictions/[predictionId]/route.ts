import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { safeMessage } from '@/lib/api/errors';
import { PREDICTION_NAME_MAX, PREDICTION_NAME_REGEX } from '@/lib/constants';

type RouteContext = {
  params: Promise<{ id: string; predictionId: string }>;
};

interface UpdatePayload {
  predictionName?: string;
  totalGoals?: number | null;
  championTeamId?: string | null;
  submit?: boolean;
  groups?: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout?: Array<{ matchId: string; winner: string | null }>;
  advancers?: Array<{ rank: number; teamId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { id: userId, predictionId } = await context.params;

  const { data: prediction } = await ctx.supabase
    .from('predictions')
    .select(
      'id, prediction_name, tournament_id, total_goals, champion_team_id, submitted_at, tournament_payments!prediction_id(paid_at, marked_by)'
    )
    .eq('id', predictionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!prediction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // predictions.user_id FK is on auth.users, not public.profiles, so we
  // fetch the username separately (admins always have profile read).
  const { data: profileRow } = await ctx.supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  const [groupsRes, knockoutRes, advancersRes] = await Promise.all([
    ctx.supabase
      .from('group_predictions')
      .select('group_id, first_team_id, second_team_id, third_team_id, fourth_team_id')
      .eq('prediction_id', predictionId),
    ctx.supabase
      .from('knockout_predictions')
      .select('match_id, winner_team_id')
      .eq('prediction_id', predictionId),
    ctx.supabase
      .from('advancer_predictions')
      .select('rank, team_id')
      .eq('prediction_id', predictionId),
  ]);

  type Payment = { paid_at: string | null; marked_by: string | null };
  type Pred = typeof prediction & {
    tournament_payments: Payment | Payment[] | null;
  };
  const p = prediction as Pred;
  const rawPayment = p.tournament_payments;
  const payment: Payment | null = !rawPayment
    ? null
    : Array.isArray(rawPayment)
      ? (rawPayment[0] ?? null)
      : rawPayment;

  return NextResponse.json({
    id: p.id,
    name: p.prediction_name,
    username: profileRow?.username ?? null,
    tournamentId: p.tournament_id,
    totalGoals: p.total_goals,
    championTeamId: p.champion_team_id,
    submittedAt: p.submitted_at,
    isPaid: payment != null,
    paidAt: payment?.paid_at ?? null,
    markedBy: payment?.marked_by ?? null,
    groups: (groupsRes.data ?? []).map((g) => ({
      groupId: g.group_id,
      first: g.first_team_id,
      second: g.second_team_id,
      third: g.third_team_id,
      fourth: g.fourth_team_id,
    })),
    knockout: (knockoutRes.data ?? []).map((k) => ({
      matchId: k.match_id,
      winner: k.winner_team_id,
    })),
    advancers: (advancersRes.data ?? []).map((a) => ({
      rank: a.rank as number,
      teamId: a.team_id as string,
    })),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { id: userId, predictionId } = await context.params;

  const body = (await request.json()) as UpdatePayload;

  const { data: prediction } = await ctx.supabase
    .from('predictions')
    .select('id, tournament_id, user_id')
    .eq('id', predictionId)
    .maybeSingle();
  if (!prediction || prediction.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const name = body.predictionName?.trim();
  if (name && (name.length > PREDICTION_NAME_MAX || !PREDICTION_NAME_REGEX.test(name))) {
    return NextResponse.json({ error: 'predictionName format invalid' }, { status: 400 });
  }
  if (body.totalGoals != null && (body.totalGoals < 0 || body.totalGoals > 200)) {
    return NextResponse.json({ error: 'totalGoals must be 0-200' }, { status: 400 });
  }
  if (!Array.isArray(body.groups) || !Array.isArray(body.knockout)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const hasChampionField = Object.prototype.hasOwnProperty.call(body, 'championTeamId');
  const championTeamId = body.championTeamId?.trim() || null;
  if (hasChampionField && !championTeamId) {
    return NextResponse.json({ error: 'championTeamId is required' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    tournament_id: prediction.tournament_id,
    prediction_id: predictionId,
    prediction_name: name ?? null,
    total_goals: body.totalGoals,
    submit: body.submit !== false,
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
    advancers: (body.advancers ?? []).map((a) => ({
      rank: a.rank,
      team_id: a.teamId,
    })),
  };
  if (hasChampionField) {
    payload.champion_team_id = championTeamId;
  }

  const { data, error } = await ctx.supabase.rpc('admin_submit_predictions', {
    p_user_id: userId,
    payload,
  });
  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('not found')) status = 404;
    else if (msg.includes('name taken')) status = 409;
    else if (msg.includes('duplicate advancer')) status = 409;
    else if (msg.includes('advancer')) status = 400;
    else if (msg.includes('champion pick')) status = 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }
  return NextResponse.json({ predictionId: data });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;
  const { id: userId, predictionId } = await context.params;

  const { error, count } = await ctx.supabase
    .from('predictions')
    .delete({ count: 'exact' })
    .eq('id', predictionId)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }
  if (!count) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
