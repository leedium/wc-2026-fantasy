'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Gift, HeartHandshake, ShieldCheck, UserCheck, Users } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchJSON } from '@/lib/api/fetchJSON';
import { OPERATING_COSTS, PRICING } from '@/lib/constants';
import { computeAuditAccounting, type AuditCounts } from '@/lib/audit';
import { formatCAD } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface AuditStatsResponse extends AuditCounts {
  tournament: { id: string; status: string; lockTime: string | null };
}

function LedgerRow({
  label,
  detail,
  amount,
  variant,
}: {
  label: string;
  detail?: string;
  amount: number;
  variant?: 'strong' | 'total' | 'muted';
}) {
  const sign = amount < 0 ? '−' : '';
  const display = `${sign}${formatCAD(Math.abs(amount), { cents: true })}`;
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-2',
        variant === 'total' && 'border-foreground/70 mt-1 border-t-2 pt-3'
      )}
    >
      <div>
        <p
          className={cn(
            'leading-tight',
            variant === 'muted' ? 'font-normal' : 'font-medium',
            (variant === 'strong' || variant === 'total') && 'font-semibold'
          )}
        >
          {label}
        </p>
        {detail ? <p className="text-muted-foreground text-xs">{detail}</p> : null}
      </div>
      <p
        className={cn(
          'shrink-0 font-mono tabular-nums',
          variant === 'total' && 'text-lg font-bold',
          variant === 'total' &&
            (amount < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-700 dark:text-green-400'),
          variant === 'strong' && 'font-semibold'
        )}
      >
        {display}
      </p>
    </div>
  );
}

export function AuditPageContent() {
  const query = useQuery<AuditStatsResponse>({
    queryKey: ['audit-stats'],
    queryFn: () => fetchJSON('/api/audit/stats'),
    // Real-time: always refetch on mount and poll while the page is open.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });

  const counts = query.data;
  const accounting = counts
    ? computeAuditAccounting(counts, { pricing: PRICING, costs: OPERATING_COSTS })
    : null;

  const isLoading = query.isLoading;
  const appliedRewards = counts
    ? counts.referralCreditsRedeemed + counts.loyaltyCreditsRedeemed
    : 0;

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
          <ShieldCheck className="text-primary h-7 w-7" />
          Audit &amp; Transparency
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          A live, open view of the pool&apos;s numbers — who&apos;s in, what&apos;s been paid, how
          much goes to charity, what it costs to run, and what&apos;s left. Figures refresh
          automatically.
        </p>
      </div>

      {query.isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="text-destructive py-6 text-sm" role="alert">
            Couldn&apos;t load audit data. Please try again shortly.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Dashboard: general stats */}
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={Users}
              label="Total members"
              value={(counts?.totalRegistrations ?? 0).toLocaleString()}
              subtitle="Registered accounts"
              isLoading={isLoading}
            />
            <StatCard
              icon={UserCheck}
              label="Paid members"
              value={(counts?.usersWithPaidPrediction ?? 0).toLocaleString()}
              subtitle={`of ${(counts?.totalRegistrations ?? 0).toLocaleString()} members`}
              isLoading={isLoading}
            />
            <StatCard
              icon={Banknote}
              label="Total revenue"
              value={formatCAD(accounting?.grossIncome ?? 0)}
              subtitle={`${(counts?.cashPaidCount ?? 0).toLocaleString()} paid entries × ${formatCAD(
                PRICING.entryFeeCAD
              )}`}
              isLoading={isLoading}
            />
            <StatCard
              icon={HeartHandshake}
              label="Charity total"
              value={formatCAD(accounting?.charity ?? 0)}
              subtitle={`${formatCAD(PRICING.charityPortionCAD)} per paid entry`}
              isLoading={isLoading}
            />
            <StatCard
              icon={Gift}
              label="Applied rewards"
              value={appliedRewards.toLocaleString()}
              subtitle={`Referral ${counts?.referralCreditsRedeemed ?? 0} · Loyalty ${
                counts?.loyaltyCreditsRedeemed ?? 0
              }`}
              isLoading={isLoading}
            />
          </div>

          {/* Formal accounting ledger */}
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Tournament Accounting</CardTitle>
              <CardDescription>
                Charity is {formatCAD(PRICING.charityPortionCAD)} per paid entry. Operating costs
                are the flat costs of running this ~2-month tournament.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading || !accounting ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <dl className="divide-border divide-y text-sm">
                    <LedgerRow
                      label="Gross income"
                      detail={`${counts!.cashPaidCount.toLocaleString()} paid entries × ${formatCAD(
                        PRICING.entryFeeCAD
                      )}`}
                      amount={accounting.grossIncome}
                      variant="strong"
                    />
                    <LedgerRow
                      label="Charity"
                      detail={`${formatCAD(PRICING.charityPortionCAD)} per paid entry`}
                      amount={-accounting.charity}
                    />

                    <div className="pt-3">
                      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        Operating costs
                      </p>
                    </div>
                    {accounting.costLines.map((line) => (
                      <LedgerRow
                        key={line.label}
                        label={line.label}
                        detail={line.detail}
                        amount={-line.amount}
                        variant="muted"
                      />
                    ))}
                    <LedgerRow
                      label="Total costs"
                      amount={-accounting.totalCosts}
                      variant="strong"
                    />

                    <LedgerRow label="Net" amount={accounting.netPayout} variant="total" />
                  </dl>
                  <p className="text-muted-foreground mt-4 text-xs">
                    Net is the surplus after charity and operating costs — the pool available to
                    return to players, equivalently the operator&apos;s retained margin.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageLayout>
  );
}
