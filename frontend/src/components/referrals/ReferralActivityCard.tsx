'use client';

import { Gift } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRewardsStatus } from '@/hooks/useRewardsStatus';

/**
 * Three-stat summary of the caller's referral activity. Mounted on
 * `/rewards` alongside `<LoyaltyActivityCard />`. Reads the referral
 * branch of the unified rewards status.
 */
export function ReferralActivityCard() {
  const { status, isLoading } = useRewardsStatus();
  const referral = status.referral;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Your referral activity
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
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat
              label="Free picks available"
              value={referral.available}
              emphasis={referral.available > 0}
            />
            <Stat label="Friends paid" value={referral.qualifiedTotal} />
            <Stat label="Credits used" value={referral.redeemedTotal} />
          </div>
        )}
        <p className="text-muted-foreground mt-4 text-xs">
          Credits unlock <em>only after</em> a referred friend&apos;s payment is
          confirmed by an admin. We don&apos;t show who used your code — only the
          counts.
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
