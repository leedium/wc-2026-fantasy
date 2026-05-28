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
    return NextResponse.json({ advancers: [] });
  }

  const { data, error } = await supabase
    .from('tournament_advancers')
    .select('rank, team_id')
    .eq('tournament_id', tournament.id)
    .order('rank', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    advancers: (data ?? []).map((r) => ({
      rank: r.rank as number,
      teamId: r.team_id as string,
    })),
  });
}
