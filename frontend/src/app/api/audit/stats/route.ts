import { NextResponse } from 'next/server';

import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Logged-in-only aggregate stats for the /audit transparency page. Returns
 * PII-free counts (no usernames/emails) via the get_audit_stats RPC. The
 * accounting math (revenue → costs → net payout) is computed client-side from
 * these counts + OPERATING_COSTS so the figures stay configurable in one place.
 */
export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, status, lock_time')
    .eq('is_active', true)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!tournament) return NextResponse.json({ error: 'No active tournament' }, { status: 404 });

  const { data, error } = await supabase.rpc('get_audit_stats', {
    p_tournament_id: tournament.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = (data?.[0] ?? {}) as {
    total_registrations?: number;
    users_with_paid_prediction?: number;
    total_entries?: number;
    cash_paid_count?: number;
    free_entries?: number;
    referral_credits_redeemed?: number;
    loyalty_credits_redeemed?: number;
  };

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      status: tournament.status,
      lockTime: tournament.lock_time,
    },
    totalRegistrations: row.total_registrations ?? 0,
    usersWithPaidPrediction: row.users_with_paid_prediction ?? 0,
    totalEntries: row.total_entries ?? 0,
    cashPaidCount: row.cash_paid_count ?? 0,
    freeEntries: row.free_entries ?? 0,
    referralCreditsRedeemed: row.referral_credits_redeemed ?? 0,
    loyaltyCreditsRedeemed: row.loyalty_credits_redeemed ?? 0,
  });
}
