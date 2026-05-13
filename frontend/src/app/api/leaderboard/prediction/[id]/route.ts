import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

interface RpcRow {
  prediction_id: string;
  prediction_name: string;
  username: string;
  total_goals: number | null;
  submitted_at: string | null;
  groups: Array<{
    group_id: string;
    first_team_id: string | null;
    second_team_id: string | null;
    third_team_id: string | null;
    fourth_team_id: string | null;
  }> | null;
  knockout: Array<{ match_id: string; winner_team_id: string | null }> | null;
  advancers: Array<{ rank: number; team_id: string }> | null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await getServerSupabase();

  // Require auth. The RPC enforces it too (auth.uid() is not null), but
  // failing fast here gives a cleaner 401 instead of an empty result.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('get_public_prediction', {
    p_prediction_id: id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as RpcRow[];
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: row.prediction_id,
    name: row.prediction_name,
    username: row.username,
    totalGoals: row.total_goals,
    submittedAt: row.submitted_at,
    // The RPC only ever returns paid + submitted predictions, so these are
    // always true. Kept for shape-compat with BracketPreviewDialog.
    isPaid: true,
    paidAt: null,
    groups: (row.groups ?? []).map((g) => ({
      groupId: g.group_id,
      first: g.first_team_id,
      second: g.second_team_id,
      third: g.third_team_id,
      fourth: g.fourth_team_id,
    })),
    knockout: (row.knockout ?? []).map((k) => ({
      matchId: k.match_id,
      winner: k.winner_team_id,
    })),
    advancers: (row.advancers ?? []).map((a) => ({
      rank: a.rank,
      teamId: a.team_id,
    })),
  });
}
