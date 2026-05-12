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
    return NextResponse.json({ assignments: [] });
  }

  const { data, error } = await supabase
    .from('r32_bracket_assignments')
    .select('match_id, slot, team_id')
    .eq('tournament_id', tournament.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    assignments: (data ?? []).map((r) => ({
      matchId: r.match_id as string,
      slot: r.slot as 1 | 2,
      teamId: r.team_id as string,
    })),
  });
}
