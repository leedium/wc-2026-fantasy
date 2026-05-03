import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('knockout_matches')
    .select('id, stage, team1_source, team2_source, point_value, match_order')
    .order('match_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    data.map((m) => ({
      id: m.id,
      stage: m.stage,
      team1Source: m.team1_source,
      team2Source: m.team2_source,
      pointValue: m.point_value,
    })),
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
