'use client';

import Link from 'next/link';

import { PageLayout } from '@/components/layout/PageLayout';
import { ReferralActivityCard } from '@/components/referrals/ReferralActivityCard';
import { LoyaltyActivityCard } from '@/components/rewards/LoyaltyActivityCard';
import { ROUTES } from '@/lib/constants';

/**
 * Credit hub. Combines referral activity (earned by inviting friends) and
 * loyalty activity (earned by paying for predictions yourself). Both surface
 * through the unified `useRewardsStatus` hook — see /api/rewards/status.
 *
 * The dedicated /referrals page handles the share-link flow; we link to it
 * from the bottom so users coming here to check credits don't lose the
 * "invite more friends" affordance.
 */
export function RewardsPageContent() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold">Rewards</h1>
          <p className="text-muted-foreground">
            Free picks you&apos;ve earned from referrals and loyalty rewards. Redeem
            them on any unpaid bracket from the{' '}
            <Link href={ROUTES.predictions} className="text-primary hover:underline">
              predictions page
            </Link>
            .
          </p>
        </div>

        <div className="space-y-6">
          <ReferralActivityCard />
          <LoyaltyActivityCard />
        </div>

        <p className="text-muted-foreground mt-6 text-sm">
          Want to invite more friends?{' '}
          <Link href={ROUTES.referrals} className="text-primary hover:underline">
            Get your referral link →
          </Link>
        </p>
      </div>
    </PageLayout>
  );
}
