'use client';

import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { LeaderboardEntry } from '@/types/tournament';

interface TournamentInfo {
  id: string;
  slug: string;
  name: string;
  status: 'upcoming' | 'group_stage' | 'knockout' | 'completed';
  lockTime: string;
  totalEntries: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
}

interface UserList {
  total: number;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

export function AdminDashboard() {
  const tournament = useQuery<TournamentInfo>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
  });
  const leaderboard = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', 1],
    queryFn: () => fetchJSON('/api/leaderboard?page=1&pageSize=10'),
  });
  const users = useQuery<UserList>({
    queryKey: ['admin-users-count'],
    queryFn: () => fetchJSON('/api/admin/users?pageSize=1'),
  });

  const lockTime = tournament.data ? new Date(tournament.data.lockTime) : null;
  const locked = lockTime ? new Date() >= lockTime : false;

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <p className="text-muted-foreground mb-6">
        Tournament management, user administration, and live results entry.
      </p>
      <AdminNav />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tournament</CardTitle>
          </CardHeader>
          <CardContent>
            {tournament.isLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : tournament.data ? (
              <div className="space-y-1">
                <p className="font-semibold">{tournament.data.name}</p>
                <div className="text-muted-foreground text-sm">
                  Status: <Badge variant="outline">{tournament.data.status}</Badge>
                </div>
                <div className="text-muted-foreground text-sm">
                  Lock: {lockTime?.toLocaleString()}{' '}
                  {locked ? <Badge variant="outline">locked</Badge> : null}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No active tournament</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Registered users</CardTitle>
          </CardHeader>
          <CardContent>
            {users.isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-2xl font-bold">{users.data?.total ?? 0}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-2xl font-bold">{leaderboard.data?.total ?? 0}</p>
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
