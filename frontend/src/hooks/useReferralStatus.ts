'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/providers/AuthProvider';

export interface ReferralStatus {
  /** Caller's own shareable code. Null for unauthenticated callers. */
  code: string | null;
  /** Qualified referrals not yet redeemed — drives banner + menu dot. */
  availableCredits: number;
  /** Lifetime count of referrals whose referee paid at least once. */
  qualifiedTotal: number;
  /** Lifetime count of credits the user has cashed in. */
  redeemedTotal: number;
}

const ZERO: ReferralStatus = {
  code: null,
  availableCredits: 0,
  qualifiedTotal: 0,
  redeemedTotal: 0,
};

/**
 * Shared client-side read of the caller's referral state. Auto-skips
 * the fetch for signed-out users (returns zeros). Cached for 60s so
 * the menu dot and the predictions banner don't double-fetch on every
 * navigation. Mutations (redeem) should invalidate the
 * ['referralStatus'] key.
 */
export function useReferralStatus() {
  const { user, loading } = useAuthContext();
  const query = useQuery<ReferralStatus>({
    queryKey: ['referralStatus'],
    enabled: !loading && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referrals/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load referral status');
      return res.json();
    },
  });

  return {
    status: query.data ?? ZERO,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export const REFERRAL_STATUS_QUERY_KEY = ['referralStatus'] as const;
