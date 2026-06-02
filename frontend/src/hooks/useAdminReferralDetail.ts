'use client';

import { useQuery } from '@tanstack/react-query';

export interface AdminReferralOverview {
  referralCode: string | null;
  qualifiedTotal: number;
  earnedCredits: number;
  redeemedTotal: number;
  availableCredits: number;
  refereeCount: number;
}

export interface AdminReferee {
  refereeId: string;
  refereeUsername: string;
  refereeEmail: string | null;
  source: 'admin' | 'organic';
  hasPaid: boolean;
  createdAt: string;
  qualifiedAt: string | null;
}

export interface AdminReferralInbound {
  referrerId: string;
  referrerUsername: string;
  referrerCodeUsed: string;
  source: 'admin' | 'organic';
  createdAt: string;
  qualifiedAt: string | null;
}

export interface AdminReferralAuditEntry {
  id: string;
  actorUsername: string | null;
  action: 'add' | 'remove';
  referrerUsername: string | null;
  refereeUsername: string | null;
  refereeEmail: string | null;
  note: string;
  createdAt: string;
}

export interface AdminReferralDetail {
  overview: AdminReferralOverview;
  referees: AdminReferee[];
  inbound: AdminReferralInbound | null;
  audit: AdminReferralAuditEntry[];
}

export const adminReferralDetailKey = (userId: string | null) =>
  ['admin-referral-detail', userId] as const;

/**
 * Full referral state for one member, backed by `/api/admin/referrals`.
 * Mutations (add/remove) should invalidate the matching detail key on success.
 */
export function useAdminReferralDetail(userId: string | null) {
  return useQuery<AdminReferralDetail>({
    queryKey: adminReferralDetailKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/referrals?userId=${encodeURIComponent(userId!)}`);
      if (!res.ok) throw new Error('Failed to load referral detail');
      return res.json();
    },
  });
}
