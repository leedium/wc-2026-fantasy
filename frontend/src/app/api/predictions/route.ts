import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

interface SubmitPayload {
  tournamentId?: string;
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

  const { data: prediction } = await supabase
    .from('predictions')
    .select('id, total_goals, submitted_at')
    .eq('user_id', user.id)
    .eq('tournament_id', tournament.id)
    .maybeSingle();

  if (!prediction) {
    return NextResponse.json({
      tournamentId: tournament.id,
      totalGoals: null,
      groups: [],
      knockout: [],
      submittedAt: null,
    });
  }

  const [groupsRes, knockoutRes] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('group_id, first_team_id, second_team_id, third_team_id, fourth_team_id')
      .eq('prediction_id', prediction.id),
    supabase
      .from('knockout_predictions')
      .select('match_id, winner_team_id')
      .eq('prediction_id', prediction.id),
  ]);

  return NextResponse.json({
    tournamentId: tournament.id,
    totalGoals: prediction.total_goals,
    submittedAt: prediction.submitted_at,
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
  if (body.totalGoals != null && (body.totalGoals < 0 || body.totalGoals > 50)) {
    return NextResponse.json({ error: 'totalGoals must be 0-50' }, { status: 400 });
  }
  // Basic shape check (deeper validation happens server-side via FKs/RLS + RPC).
  if (!Array.isArray(body.groups) || !Array.isArray(body.knockout)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const payload = {
    tournament_id: body.tournamentId,
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

  const { data, error } = await supabase.rpc('submit_predictions', { payload });
  if (error) {
    const status = error.message.includes('locked') ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ predictionId: data });
}
