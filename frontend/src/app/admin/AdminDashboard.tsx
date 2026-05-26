'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Banknote,
  CircleDollarSign,
  Clock,
  Crown,
  Gift,
  HeartHandshake,
  ListChecks,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaderboardEntry, Team } from '@/types/tournament';

interface AdminStats {
  tournament: {
    id: string;
    status: 'upcoming' | 'group_stage' | 'knockout' | 'completed';
    lockTime: string;
    isLocked: boolean;
  };
  totalRegistrations: number;
  usersWithPaidPrediction: number;
  totalEntries: number;
  cashPaidCount: number;
  freeEntries: number;
  potTotalCAD: number;
  charityTotalCAD: number;
  referralCreditsEarned: number;
  referralCreditsRedeemed: number;
  loyaltyCreditsEarned: number;
  loyaltyCreditsRedeemed: number;
  topChampionTeamId: string | null;
  topChampionPickCount: number;
  topUsers: Array<{
    userId: string;
    username: string | null;
    email: string | null;
    paidCount: number;
  }>;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

const CAD = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

function formatTimeRemaining(lockMs: number, nowMs: number): string {
  const diff = lockMs - nowMs;
  if (diff <= 0) return 'Locked';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle ? (
              <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const stats = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => fetchJSON('/api/admin/stats'),
    // Belt-and-suspenders for cache freshness: every mutation that affects
    // dashboard counts (mark-paid, create/delete user, tournament reset,
    // tournament/phase lock changes) explicitly invalidates this key.
    // staleTime: 0 + refetchOnMount: 'always' guarantees navigating to
    // /admin still refetches even if a new mutation forgets to invalidate.
    // refetchInterval keeps the page live for long-open sessions.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
  const leaderboard = useQuery<LeaderboardResponse>({
    // /admin is gated by middleware to admins only, so the response
    // shape will always include the admin-only `email` field. Keep
    // the viewer-tagged key in sync with LeaderboardPageContent.
    queryKey: ['leaderboard', 1, 'admin'],
    queryFn: () => fetchJSON('/api/leaderboard?page=1&pageSize=10'),
  });
  const teams = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchJSON('/api/teams'),
  });

  // Tick once per minute so the lock countdown updates without a refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const data = stats.data;
  const isLoading = stats.isLoading;
  const lockTime = data ? new Date(data.tournament.lockTime) : null;
  const locked = data?.tournament.isLocked ?? false;

  const topChampionTeamId = data?.topChampionTeamId ?? null;
  const topTeam = topChampionTeamId
    ? (teams.data?.find((t) => t.id === topChampionTeamId) ?? null)
    : null;

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <p className="text-muted-foreground mb-6">
        Tournament management, user administration, and live results entry.
      </p>
      <AdminNav />

      {/* Row 1: Tournament + Users */}
      <h2 className="mb-3 text-lg font-semibold">Tournament</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Trophy}
          label="Status"
          value={
            <Badge variant="outline" className="text-sm font-semibold">
              {data?.tournament.status ?? '—'}
            </Badge>
          }
          subtitle={locked ? 'Predictions locked' : 'Predictions open'}
          isLoading={isLoading}
        />
        <StatCard
          icon={Clock}
          label="Lock countdown"
          value={lockTime ? formatTimeRemaining(lockTime.getTime(), now) : '—'}
          subtitle={lockTime?.toLocaleString()}
          isLoading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Registered users"
          value={(data?.totalRegistrations ?? 0).toLocaleString()}
          isLoading={isLoading}
        />
        <StatCard
          icon={UserCheck}
          label="Users with paid entry"
          value={(data?.usersWithPaidPrediction ?? 0).toLocaleString()}
          subtitle={
            data && data.totalRegistrations > 0
              ? `${Math.round((data.usersWithPaidPrediction / data.totalRegistrations) * 100)}% of registrations`
              : null
          }
          isLoading={isLoading}
        />
      </div>

      {/* Row 2: Entries + Money */}
      <h2 className="mb-3 text-lg font-semibold">Entries & money</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ListChecks}
          label="Total entries"
          value={(data?.totalEntries ?? 0).toLocaleString()}
          subtitle={
            data ? `${data.cashPaidCount} cash · ${data.freeEntries} free` : null
          }
          isLoading={isLoading}
        />
        <StatCard
          icon={Banknote}
          label="Cash entries"
          value={(data?.cashPaidCount ?? 0).toLocaleString()}
          isLoading={isLoading}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Pot total"
          value={CAD.format(data?.potTotalCAD ?? 0)}
          isLoading={isLoading}
        />
        <StatCard
          icon={HeartHandshake}
          label="Raised for charity"
          value={CAD.format(data?.charityTotalCAD ?? 0)}
          isLoading={isLoading}
        />
      </div>

      {/* Row 3: Credits */}
      <h2 className="mb-3 text-lg font-semibold">Free-pick credits</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={UserPlus}
          label="Referral credits"
          value={(data?.referralCreditsEarned ?? 0).toLocaleString()}
          subtitle={
            data ? `${data.referralCreditsRedeemed} redeemed (lifetime)` : null
          }
          isLoading={isLoading}
        />
        <StatCard
          icon={Award}
          label="Loyalty credits"
          value={(data?.loyaltyCreditsEarned ?? 0).toLocaleString()}
          subtitle={
            data ? `${data.loyaltyCreditsRedeemed} redeemed (this tournament)` : null
          }
          isLoading={isLoading}
        />
        <StatCard
          icon={Gift}
          label="Free entries (applied)"
          value={(data?.freeEntries ?? 0).toLocaleString()}
          subtitle="Sum of redemptions on the leaderboard"
          isLoading={isLoading}
        />
      </div>

      {/* Row 4: Engagement */}
      <h2 className="mb-3 text-lg font-semibold">Engagement</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Most-picked champion (Phase 1)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : topTeam ? (
              <div className="flex items-center gap-3">
                <TeamFlag code={topTeam.code} className="h-8 w-12 rounded" />
                <div>
                  <p className="font-semibold">{topTeam.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {data?.topChampionPickCount ?? 0} pick
                    {(data?.topChampionPickCount ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No picks yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Top 3 by paid entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : data && data.topUsers.length > 0 ? (
              <ol className="space-y-2 text-sm">
                {data.topUsers.map((u, i) => (
                  <li key={u.userId} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="h-5 w-5 justify-center p-0">
                        {i + 1}
                      </Badge>
                      <span className="truncate">{u.email ?? u.username ?? u.userId}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {u.paidCount} paid
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">No paid entries yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live leaderboard (top 10)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leaderboard.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <LeaderboardTable
              entries={leaderboard.data?.entries ?? []}
              currentUsername={null}
              highlightedRank={null}
            />
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
