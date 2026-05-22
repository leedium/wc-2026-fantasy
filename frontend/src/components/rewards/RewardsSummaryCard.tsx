'use client';

import Link from 'next/link';
import { Gift } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRewardsStatus } from '@/hooks/useRewardsStatus';
import { ROUTES } from '@/lib/constants';

/**
 * Compact "you have N free picks" tile for /account. Links to /rewards for
 * the full breakdown so the account page stays a single, scannable form.
 */
export function RewardsSummaryCard() {
  const { status, isLoading } = useRewardsStatus();
  const total = status.totalAvailable;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Gift
            className={
              total > 0
                ? 'h-6 w-6 text-green-600 dark:text-green-400'
                : 'text-muted-foreground h-6 w-6'
            }
            aria-hidden
          />
          {isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <div>
              <div
                className={
                  total > 0
                    ? 'text-base font-semibold text-green-700 dark:text-green-400'
                    : 'text-base font-medium'
                }
              >
                {total === 0
                  ? 'No free picks available'
                  : total === 1
                    ? '1 free pick available'
                    : `${total} free picks available`}
              </div>
              <div className="text-muted-foreground text-xs">
                From referrals and loyalty rewards
              </div>
            </div>
          )}
        </div>
        <Link
          href={ROUTES.rewards}
          className="text-primary text-sm hover:underline"
        >
          View details →
        </Link>
      </CardContent>
    </Card>
  );
}
