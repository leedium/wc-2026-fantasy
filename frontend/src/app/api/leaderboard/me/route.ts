import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (!tournament) return NextResponse.json({ matches: [] });

  const { data, error } = await supabase.rpc('get_leaderboard_rank', {
    p_tournament_id: tournament.id,
    p_user_id: user.id,
    p_page_size: pageSize,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    prediction_id: string;
    prediction_name: string;
    rank: number;
    page: number;
    points: number | string;
  };
  const rows = (data ?? []) as Row[];

  return NextResponse.json({
    matches: rows.map((r) => ({
      predictionId: r.prediction_id,
      predictionName: r.prediction_name,
      rank: r.rank,
      page: r.page,
      points: Number(r.points),
    })),
  });
}
