import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));

  const supabase = await getServerSupabase();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (!tournament) {
    return NextResponse.json({ entries: [], total: 0, page, pageSize });
  }

  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_tournament_id: tournament.id,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    rank: number;
    username: string;
    points: number;
    group_points: number;
    knockout_points: number;
    total_goals: number | null;
    total_count: number;
  }>;

  return NextResponse.json({
    entries: rows.map((row) => ({
      rank: row.rank,
      username: row.username,
      points: row.points,
      change: 0,
      groupPoints: row.group_points,
      knockoutPoints: row.knockout_points,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
  });
}
