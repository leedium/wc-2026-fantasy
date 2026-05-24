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

  // Whether the admin has finished posting the 8 ranked 3rd-place
  // advancers. Used by the banner to differentiate phase1_locked states:
  //   * advancers not yet set → "Waiting for admin to post the advancers"
  //   * advancers set + phase 2 closed → "Knockout predictions paused"
  // tournament_advancers has a public SELECT policy so this works for
  // unauthenticated visitors too.
  const advancersCountRes = await supabase
    .from('tournament_advancers')
    .select('rank', { count: 'exact', head: true })
    .eq('tournament_id', tournamentRes.data.id);
  const advancersSet = (advancersCountRes.count ?? 0) === 8;

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

  // Live entry counts. Mirrors get_leaderboard's eligibility predicate
  // (supabase/migrations/0036_champion_pick.sql:589-595): payment row with
  // paid_at <= lock_time. totalEntries counts both cash and free-pick rows;
  // cashPaidPredictionCount filters is_free = false so the displayed pot
  // reflects actual money collected (not inflated by referral/loyalty
  // redemptions).
  const [totalEntriesRes, cashPaidRes] = await Promise.all([
    supabase
      .from('tournament_payments')
      .select('prediction_id, predictions!inner(tournament_id)', {
        count: 'exact',
        head: true,
      })
      .eq('predictions.tournament_id', data.id)
      .lte('paid_at', data.lock_time),
    supabase
      .from('tournament_payments')
      .select('prediction_id, predictions!inner(tournament_id)', {
        count: 'exact',
        head: true,
      })
      .eq('predictions.tournament_id', data.id)
      .eq('is_free', false)
      .lte('paid_at', data.lock_time),
  ]);

  const totalEntries = totalEntriesRes.count ?? 0;
  const cashPaidPredictionCount = cashPaidRes.count ?? 0;
  const potTotalCAD = cashPaidPredictionCount * PRICING.entryFeeCAD;

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
    advancersSet,
    phase,
    totalEntries,
    cashPaidPredictionCount,
    potTotalCAD,
    championTotalGoals: data.champion_total_goals,
    serverTime,
  });
}
