'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/providers/AuthProvider';

export interface RewardsStatus {
  /** Caller's own shareable referral code. Null for unauthenticated callers. */
  referralCode: string | null;
  /** Sum of free picks across all sources — drives the menu badge + banner. */
  totalAvailable: number;
  referral: {
    /** Referrals qualified but not yet redeemed. */
    available: number;
    /** Lifetime count of referrals whose referee paid at least once. */
    qualifiedTotal: number;
    /** Lifetime count of referral credits the user has cashed in. */
    redeemedTotal: number;
  };
  loyalty: {
    /** Loyalty credits earned this tournament but not yet redeemed. */
    available: number;
    /** floor(cashPaid / 5) — total loyalty credits earned this tournament. */
    earned: number;
    /** Loyalty credits redeemed this tournament. */
    redeemed: number;
    /** Non-free paid predictions this tournament — drives "X/5 to next" hint. */
    cashPaid: number;
  };
}

const ZERO: RewardsStatus = {
  referralCode: null,
  totalAvailable: 0,
  referral: { available: 0, qualifiedTotal: 0, redeemedTotal: 0 },
  loyalty: { available: 0, earned: 0, redeemed: 0, cashPaid: 0 },
};

/**
 * Single source for the caller's free-pick state across the app: menu badge,
 * predictions banner + redeem-button gate, /rewards activity cards, /account
 * summary. Backed by `/api/rewards/status` which calls the `get_rewards_status`
 * RPC. Mutations (redeem) should invalidate the ['rewardsStatus'] key.
 */
export function useRewardsStatus() {
  const { user, loading } = useAuthContext();
  const query = useQuery<RewardsStatus>({
    queryKey: REWARDS_STATUS_QUERY_KEY,
    enabled: !loading && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/rewards/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load rewards status');
      return res.json();
    },
  });

  return {
    status: query.data ?? ZERO,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export const REWARDS_STATUS_QUERY_KEY = ['rewardsStatus'] as const;
