'use client';

import { Trophy } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRewardsStatus } from '@/hooks/useRewardsStatus';

/**
 * Loyalty side of the /rewards page. Mirrors ReferralActivityCard's three-
 * stat layout. Earning rule: 1 free pick per 5 cash-paid predictions in the
 * tournament (free picks themselves don't count toward the next 5 — see the
 * `is_free = false` filter in get_loyalty_status).
 */
export function LoyaltyActivityCard() {
  const { status, isLoading } = useRewardsStatus();
  const loyalty = status.loyalty;
  const toNext = loyalty.cashPaid % 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Your loyalty rewards
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 text-center">
              <Stat
                label="Free picks available"
                value={loyalty.available}
                emphasis={loyalty.available > 0}
              />
              <Stat label="Cash predictions paid" value={loyalty.cashPaid} />
              <Stat label="Credits redeemed" value={loyalty.redeemed} />
            </div>
            {loyalty.cashPaid > 0 && (
              <p className="text-muted-foreground mt-4 text-sm">
                <strong>{toNext}/5</strong> toward your next free pick.
              </p>
            )}
          </>
        )}
        <p className="text-muted-foreground mt-4 text-xs">
          Earn 1 free pick for every 5 cash-paid predictions in this tournament.
          Free picks don&apos;t count toward the next 5.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div
        className={
          emphasis
            ? 'text-2xl font-bold text-green-600 dark:text-green-400'
            : 'text-2xl font-bold'
        }
      >
        {value}
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
