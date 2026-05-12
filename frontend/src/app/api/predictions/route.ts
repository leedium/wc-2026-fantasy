import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';
import { PREDICTION_CAP, PREDICTION_NAME_MAX, PREDICTION_NAME_REGEX } from '@/lib/constants';

interface SubmitPayload {
  tournamentId?: string;
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
  advancers?: Array<{ rank: number; teamId: string }>;
}

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      'id, prediction_name, total_goals, submitted_at, tournament_payments!prediction_id(paid_at)'
    )
    .eq('user_id', user.id)
    .eq('tournament_id', tournament.id)
    .order('submitted_at', { ascending: true });

  const ids = (predictions ?? []).map((p) => p.id);

  const [groupsRes, knockoutRes, advancersRes] = await Promise.all([
    ids.length
      ? supabase
          .from('group_predictions')
          .select(
            'prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id'
          )
          .in('prediction_id', ids)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase
          .from('knockout_predictions')
          .select('prediction_id, match_id, winner_team_id')
          .in('prediction_id', ids)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase
          .from('advancer_predictions')
          .select('prediction_id, rank, team_id')
          .in('prediction_id', ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  type GroupRow = {
    prediction_id: string;
    group_id: string;
    first_team_id: string | null;
    second_team_id: string | null;
    third_team_id: string | null;
    fourth_team_id: string | null;
  };
  type KnockoutRow = {
    prediction_id: string;
    match_id: string;
    winner_team_id: string | null;
  };

  type AdvancerRow = {
    prediction_id: string;
    rank: number;
    team_id: string;
  };

  const groupsByPrediction = new Map<string, GroupRow[]>();
  for (const g of (groupsRes.data ?? []) as GroupRow[]) {
    const list = groupsByPrediction.get(g.prediction_id) ?? [];
    list.push(g);
    groupsByPrediction.set(g.prediction_id, list);
  }
  const knockoutByPrediction = new Map<string, KnockoutRow[]>();
  for (const k of (knockoutRes.data ?? []) as KnockoutRow[]) {
    const list = knockoutByPrediction.get(k.prediction_id) ?? [];
    list.push(k);
    knockoutByPrediction.set(k.prediction_id, list);
  }
  const advancersByPrediction = new Map<string, AdvancerRow[]>();
  for (const a of (advancersRes.data ?? []) as AdvancerRow[]) {
    const list = advancersByPrediction.get(a.prediction_id) ?? [];
    list.push(a);
    advancersByPrediction.set(a.prediction_id, list);
  }

  type Payment = { paid_at: string | null };
  type PredictionRow = {
    id: string;
    prediction_name: string;
    total_goals: number | null;
    submitted_at: string | null;
    tournament_payments: Payment | Payment[] | null;
  };

  return NextResponse.json({
    tournament: { id: tournament.id, lockTime: tournament.lock_time },
    cap: PREDICTION_CAP,
    predictions: ((predictions ?? []) as PredictionRow[]).map((p) => {
      const raw = p.tournament_payments;
      const payment: Payment | null = !raw
        ? null
        : Array.isArray(raw)
          ? (raw[0] ?? null)
          : raw;
      return {
        id: p.id,
        name: p.prediction_name,
        totalGoals: p.total_goals,
        submittedAt: p.submitted_at,
        isPaid: payment != null,
        paidAt: payment?.paid_at ?? null,
        groups: (groupsByPrediction.get(p.id) ?? []).map((g) => ({
          groupId: g.group_id,
          first: g.first_team_id,
          second: g.second_team_id,
          third: g.third_team_id,
          fourth: g.fourth_team_id,
        })),
        knockout: (knockoutByPrediction.get(p.id) ?? []).map((k) => ({
          matchId: k.match_id,
          winner: k.winner_team_id,
        })),
        advancers: (advancersByPrediction.get(p.id) ?? []).map((a) => ({
          rank: a.rank,
          teamId: a.team_id,
        })),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const { data, error } = await supabase.rpc('submit_predictions', { payload });
  if (error) {
    const msg = error.message ?? '';
    let status = 400;
    if (msg.includes('locked')) status = 403;
    else if (msg.includes('limit reached') || msg.includes('name taken')) status = 409;
    else if (msg.includes('duplicate advancer')) status = 409;
    else if (msg.includes('advancer')) status = 400;
    return NextResponse.json({ error: safeMessage(error) }, { status });
  }

  return NextResponse.json({ predictionId: data });
}
