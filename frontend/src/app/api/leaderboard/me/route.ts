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

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ rank: null, page: null, points: null });

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (!tournament) return NextResponse.json({ rank: null, page: null, points: null });

  const { data, error } = await supabase.rpc('get_leaderboard_rank', {
    p_tournament_id: tournament.id,
    p_username: profile.username,
    p_page_size: pageSize,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = (data ?? [])[0] as { rank: number; page: number; points: number } | undefined;
  if (!row) return NextResponse.json({ rank: null, page: null, points: null });

  return NextResponse.json({ rank: row.rank, page: row.page, points: row.points });
}
