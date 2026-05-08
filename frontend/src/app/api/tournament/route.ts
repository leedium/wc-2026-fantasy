import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await getServerSupabase();
  const [tournamentRes, serverTimeRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, slug, name, status, lock_time, total_entries, champion_total_goals')
      .eq('is_active', true)
      .maybeSingle(),
    supabase.rpc('select_now'),
  ]);

  if (tournamentRes.error) {
    return NextResponse.json({ error: tournamentRes.error.message }, { status: 500 });
  }
  if (!tournamentRes.data) {
    return NextResponse.json({ error: 'No active tournament' }, { status: 404 });
  }

  const data = tournamentRes.data;
  // serverTime defaults to the request's wall clock if the RPC ever fails;
  // the client treats this as zero skew (degraded but not broken).
  const serverTime =
    typeof serverTimeRes.data === 'string'
      ? new Date(serverTimeRes.data).toISOString()
      : new Date().toISOString();

  return NextResponse.json({
    id: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    lockTime: data.lock_time,
    totalEntries: data.total_entries,
    championTotalGoals: data.champion_total_goals,
    serverTime,
  });
}
