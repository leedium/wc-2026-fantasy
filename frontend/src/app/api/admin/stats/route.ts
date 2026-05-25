import { NextResponse } from 'next/server';
import { requireAdmin, isAdminGateError } from '@/lib/auth/requireAdmin';
import { PRICING } from '@/lib/constants';

export async function GET() {
  const ctx = await requireAdmin();
  if (isAdminGateError(ctx)) return ctx.response;

  const { data: tournament, error: tErr } = await ctx.supabase
    .from('tournaments')
    .select('id, status, lock_time')
    .eq('is_active', true)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!tournament) return NextResponse.json({ error: 'No active tournament' }, { status: 404 });

  const { data, error } = await ctx.supabase.rpc('admin_get_dashboard_stats', {
    p_tournament_id: tournament.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = (data?.[0] ?? {}) as {
    total_registrations?: number;
    users_with_paid_prediction?: number;
    total_entries?: number;
    cash_paid_count?: number;
    free_entries?: number;
    referral_credits_earned?: number;
    referral_credits_redeemed?: number;
    loyalty_credits_earned?: number;
    loyalty_credits_redeemed?: number;
    top_champion_team_id?: string | null;
    top_champion_pick_count?: number | null;
    top_users?: Array<{
      user_id: string;
      username: string | null;
      email: string | null;
      paid_count: number;
    }>;
  };

  const cashPaidCount = row.cash_paid_count ?? 0;

  const lockMs = tournament.lock_time ? new Date(tournament.lock_time).getTime() : null;
  const isLocked = lockMs !== null && Date.now() >= lockMs;

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      status: tournament.status,
      lockTime: tournament.lock_time,
      isLocked,
    },
    totalRegistrations: row.total_registrations ?? 0,
    usersWithPaidPrediction: row.users_with_paid_prediction ?? 0,
    totalEntries: row.total_entries ?? 0,
    cashPaidCount,
    freeEntries: row.free_entries ?? 0,
    potTotalCAD: cashPaidCount * PRICING.entryFeeCAD,
    charityTotalCAD: cashPaidCount * PRICING.charityPortionCAD,
    referralCreditsEarned: row.referral_credits_earned ?? 0,
    referralCreditsRedeemed: row.referral_credits_redeemed ?? 0,
    loyaltyCreditsEarned: row.loyalty_credits_earned ?? 0,
    loyaltyCreditsRedeemed: row.loyalty_credits_redeemed ?? 0,
    topChampionTeamId: row.top_champion_team_id ?? null,
    topChampionPickCount: row.top_champion_pick_count ?? 0,
    topUsers: (row.top_users ?? []).map((u) => ({
      userId: u.user_id,
      username: u.username,
      email: u.email,
      paidCount: u.paid_count,
    })),
  });
}
