import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { PRICING } from '@/lib/constants';

export async function GET() {
  const supabase = await getServerSupabase();
  const [tournamentRes, serverTimeRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select(
        'id, slug, name, status, lock_time, champion_total_goals, knockout_unlocked, knockout_lock_time'
      )
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

  const data = tournamentRes.data as {
    id: string;
    slug: string;
    name: string;
    status: string;
    lock_time: string;
    champion_total_goals: number | null;
    knockout_unlocked: boolean;
    knockout_lock_time: string | null;
  };

  // Live entry counts via SECURITY DEFINER RPC. A direct count against
  // tournament_payments returns 0 for logged-out visitors because the
  // table's RLS is own_or_admin (0016_multi_prediction_rls.sql). The
  // RPC bypasses RLS and returns only two aggregates — safe for public
  // display. Eligibility predicate (paid_at <= lock_time, is_free split)
  // matches get_leaderboard.
  const [potStatsRes, locksRes] = await Promise.all([
    supabase.rpc('get_tournament_pot_stats', { p_tournament_id: data.id }),
    // Per-fixture knockout locks for this tournament. Read-all RLS; powers the
    // wizard's per-match disable. Time-sensitive, so it rides this uncached route
    // (not the 1h-cached /api/knockout-matches metadata).
    supabase
      .from('knockout_match_locks')
      .select('match_id, locked_at')
      .eq('tournament_id', data.id),
  ]);
  if (potStatsRes.error) {
    return NextResponse.json({ error: potStatsRes.error.message }, { status: 500 });
  }
  if (locksRes.error) {
    return NextResponse.json({ error: locksRes.error.message }, { status: 500 });
  }
  const knockoutLocks = (
    (locksRes.data ?? []) as { match_id: string; locked_at: string }[]
  ).map((l) => ({ matchId: l.match_id, lockedAt: l.locked_at }));
  const potStats = (potStatsRes.data?.[0] ?? { total_entries: 0, cash_paid_count: 0 }) as {
    total_entries: number;
    cash_paid_count: number;
  };
  const totalEntries = potStats.total_entries;
  const cashPaidPredictionCount = potStats.cash_paid_count;
  const potTotalCAD = cashPaidPredictionCount * PRICING.entryFeeCAD;
  const charityTotalCAD = cashPaidPredictionCount * PRICING.charityPortionCAD;

  const serverTime =
    typeof serverTimeRes.data === 'string'
      ? new Date(serverTimeRes.data).toISOString()
      : new Date().toISOString();

  // Compute phase here too (mirrors public.tournament_phase) so the client
  // doesn't need a second round-trip. Source of truth for writes is the RPC.
  const now = new Date(serverTime).getTime();
  const lockMs = new Date(data.lock_time).getTime();
  const knockoutLockMs = data.knockout_lock_time
    ? new Date(data.knockout_lock_time).getTime()
    : null;
  let phase: 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';
  if (now < lockMs) phase = 'phase1';
  else if (data.knockout_unlocked && (knockoutLockMs === null || now < knockoutLockMs))
    phase = 'phase2_open';
  else if (data.knockout_unlocked) phase = 'phase2_locked';
  else phase = 'phase1_locked';

  return NextResponse.json({
    id: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    lockTime: data.lock_time,
    knockoutLockTime: data.knockout_lock_time,
    knockoutUnlocked: data.knockout_unlocked,
    phase,
    knockoutLocks,
    totalEntries,
    cashPaidPredictionCount,
    potTotalCAD,
    charityTotalCAD,
    championTotalGoals: data.champion_total_goals,
    serverTime,
  });
}
