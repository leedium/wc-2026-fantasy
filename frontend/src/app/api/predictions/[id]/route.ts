import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';
import { PREDICTION_NAME_MAX, PREDICTION_NAME_REGEX } from '@/lib/constants';

interface UpdatePayload {
  predictionName?: string;
  totalGoals?: number | null;
  submit?: boolean;
  groups?: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout?: Array<{ matchId: string; winner: string | null }>;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: prediction } = await supabase
    .from('predictions')
    .select(
      'id, prediction_name, tournament_id, total_goals, submitted_at, tournament_payments(paid_at)'
    )
    .eq('id', id)
    .maybeSingle();

  if (!prediction) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [groupsRes, knockoutRes] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('group_id, first_team_id, second_team_id, third_team_id, fourth_team_id')
      .eq('prediction_id', id),
    supabase
      .from('knockout_predictions')
      .select('match_id, winner_team_id')
      .eq('prediction_id', id),
  ]);

  type Pred = typeof prediction & {
    tournament_payments: Array<{ paid_at: string | null }> | null;
  };
  const p = prediction as Pred;
  const payment = p.tournament_payments?.[0] ?? null;

  return NextResponse.json({
    id: p.id,
    name: p.prediction_name,
    tournamentId: p.tournament_id,
    totalGoals: p.total_goals,
    submittedAt: p.submitted_at,
    isPaid: payment != null,
    paidAt: payment?.paid_at ?? null,
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
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as UpdatePayload;

  // Look up tournament for the RPC payload (the RPC validates lock + ownership).
  const { data: prediction } = await supabase
    .from('predictions')
    .select('id, tournament_id')
    .eq('id', id)
    .maybeSingle();
  if (!prediction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const name = body.predictionName?.trim();
  if (name && (name.length > PREDICTION_NAME_MAX || !PREDICTION_NAME_REGEX.test(name))) {
    return NextResponse.json({ error: 'predictionName format invalid' }, { status: 400 });
  }
  if (body.totalGoals != null && (body.totalGoals < 0 || body.totalGoals > 50)) {
    return NextResponse.json({ error: 'totalGoals must be 0-50' }, { status: 400 });
  }
  if (!Array.isArray(body.groups) || !Array.isArray(body.knockout)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const payload = {
    tournament_id: prediction.tournament_id,
    prediction_id: id,
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
  };

  const { data, error } = await supabase.rpc('submit_predictions', { payload });
  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('locked')) status = 403;
    else if (msg.includes('not found')) status = 404;
    else if (msg.includes('name taken')) status = 409;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }
  return NextResponse.json({ predictionId: data });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // RLS handles ownership + lock + not-paid. A blocked delete returns 0 rows.
  const { error, count } = await supabase
    .from('predictions')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }
  if (!count) {
    return NextResponse.json({ error: 'Cannot delete' }, { status: 403 });
  }
  return NextResponse.json({ success: true });
}
