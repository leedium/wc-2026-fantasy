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
    return NextResponse.json({ standings: [] });
  }

  const { data, error } = await supabase
    .from('group_standings')
    .select('group_id, first_team_id, second_team_id, third_team_id, fourth_team_id')
    .eq('tournament_id', tournament.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    standings: (data ?? []).map((r) => ({
      groupId: r.group_id as string,
      firstTeamId: (r.first_team_id ?? null) as string | null,
      secondTeamId: (r.second_team_id ?? null) as string | null,
      thirdTeamId: (r.third_team_id ?? null) as string | null,
      fourthTeamId: (r.fourth_team_id ?? null) as string | null,
    })),
  });
}
