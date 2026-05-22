import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { safeMessage } from '@/lib/api/errors';

/**
 * Authenticated read of the caller's free-pick state, merging the two
 * earning sources (referrals + loyalty) into one flat shape. Drives the
 * useRewardsStatus hook — see frontend/src/hooks/useRewardsStatus.ts.
 *
 * Loyalty credits are per-tournament, so we look up the active tournament
 * server-side rather than asking the client to supply an id.
 */
export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (tournamentError) {
    return NextResponse.json({ error: 'request failed' }, { status: 500 });
  }
  if (!tournament) {
    return NextResponse.json({ error: 'No active tournament' }, { status: 404 });
  }

  const { data, error } = await supabase.rpc('get_rewards_status', {
    p_tournament_id: tournament.id,
  });
  if (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json({
      referralCode: null,
      totalAvailable: 0,
      referral: { available: 0, qualifiedTotal: 0, earned: 0, redeemedTotal: 0 },
      loyalty: { available: 0, earned: 0, redeemed: 0, cashPaid: 0 },
    });
  }

  return NextResponse.json({
    referralCode: row.referral_code ?? null,
    totalAvailable: row.total_available ?? 0,
    referral: {
      available: row.referral_available ?? 0,
      qualifiedTotal: row.referral_qualified ?? 0,
      earned: row.referral_earned ?? 0,
      redeemedTotal: row.referral_redeemed ?? 0,
    },
    loyalty: {
      available: row.loyalty_available ?? 0,
      earned: row.loyalty_earned ?? 0,
      redeemed: row.loyalty_redeemed ?? 0,
      cashPaid: row.loyalty_cash_paid ?? 0,
    },
  });
}
