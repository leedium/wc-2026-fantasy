import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await supabase
    .from('knockout_results')
    .select('match_id, winner_team_id, loser_team_id, total_goals')
    .eq('tournament_id', tournament.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    results: (data ?? []).map((r) => ({
      matchId: r.match_id as string,
      winnerTeamId: (r.winner_team_id ?? null) as string | null,
      loserTeamId: (r.loser_team_id ?? null) as string | null,
      totalGoals: (r.total_goals ?? null) as number | null,
    })),
  });
}
