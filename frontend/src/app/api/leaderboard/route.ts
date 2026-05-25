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

  // Branch on admin status: admins get a wrapper RPC that also returns
  // email per entry; everyone else gets the public RPC (no email field).
  // We check is_admin via profiles since the user's session is already
  // attached to the cookie client; admin_get_leaderboard double-checks
  // is_admin() at the DB level so the API can't be tricked.
  const { data: authData } = await supabase.auth.getUser();
  let isAdmin = false;
  if (authData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', authData.user.id)
      .maybeSingle();
    isAdmin = profile?.is_admin === true;
  }

  const rpcName = isAdmin ? 'admin_get_leaderboard' : 'get_leaderboard';
  const { data, error } = await supabase.rpc(rpcName, {
    p_tournament_id: tournament.id,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Postgres `numeric` arrives as a string over the wire; coerce to Number for
  // the JSON response so the frontend can render fractional points cleanly.
  const rows = (data ?? []) as Array<{
    rank: number;
    prediction_id: string;
    prediction_name: string;
    username: string;
    email?: string | null;
    points: number | string;
    group_points: number;
    advancer_points: number | string;
    knockout_points: number;
    champion_pick_points: number;
    total_goals: number | null;
    total_count: number;
  }>;

  return NextResponse.json({
    entries: rows.map((row) => ({
      rank: row.rank,
      predictionId: row.prediction_id,
      predictionName: row.prediction_name,
      username: row.username,
      ...(isAdmin && row.email ? { email: row.email } : {}),
      points: Number(row.points),
      change: 0,
      groupPoints: row.group_points,
      advancerPoints: Number(row.advancer_points),
      knockoutPoints: row.knockout_points,
      championPickPoints: row.champion_pick_points ?? 0,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    page,
    pageSize,
  });
}
