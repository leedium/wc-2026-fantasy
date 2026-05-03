'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Trophy, Users } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants';
import type { LeaderboardEntry } from '@/types/tournament';

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 px-4 py-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-14" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export function LeaderboardPageContent() {
  const { user, profile } = useAuth();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [highlightedRank, setHighlightedRank] = React.useState<number | null>(null);

  const currentUsername = profile?.username ?? null;

  const query = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', currentPage],
    queryFn: async () => {
      const res = await fetch(
        `/api/leaderboard?page=${currentPage}&pageSize=${DEFAULT_ITEMS_PER_PAGE}`
      );
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
  });

  const isLoading = query.isLoading;
  const entries = React.useMemo(() => query.data?.entries ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_ITEMS_PER_PAGE));

  const userEntry = React.useMemo(() => {
    if (!currentUsername) return null;
    return entries.find(
      (entry) => entry.username.toLowerCase() === currentUsername.toLowerCase()
    );
  }, [entries, currentUsername]);

  const meQuery = useQuery<{ rank: number | null; page: number | null; points: number | null }>({
    queryKey: ['leaderboard-me'],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard/me?pageSize=${DEFAULT_ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error('Failed to fetch rank');
      return res.json();
    },
    enabled: !!user,
  });

  const handleFindMyRank = React.useCallback(() => {
    if (!meQuery.data?.rank || !meQuery.data.page) return;
    const { rank, page } = meQuery.data;
    if (currentPage !== page) setCurrentPage(page);
    setHighlightedRank(rank);
    setTimeout(() => {
      const el = document.getElementById(`rank-${rank}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    setTimeout(() => setHighlightedRank(null), 3000);
  }, [meQuery.data, currentPage]);

  // Prefer server-reported rank so the banner shows even when the user is not on the current page.
  const bannerRank = meQuery.data?.rank ?? userEntry?.rank ?? null;
  const bannerPoints = meQuery.data?.points ?? userEntry?.points ?? null;
  const hasRankedEntry = bannerRank !== null;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setHighlightedRank(null);
  };

  return (
    <PageLayout>
      {user && hasRankedEntry && (
        <div className="bg-primary/10 border-primary/20 sticky top-16 z-40 -mx-4 mb-6 border-y px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="text-primary h-5 w-5" />
              <div>
                <p className="text-sm font-medium">Your Rank</p>
                <p className="text-primary text-lg font-bold">#{bannerRank}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">Points</p>
                <p className="font-semibold">{bannerPoints ?? 0} pts</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleFindMyRank}>
                <Search className="mr-2 h-4 w-4" />
                Find Me
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span>{total.toLocaleString()} participants</span>
            )}
          </p>
        </div>
        {user && !hasRankedEntry && !isLoading && !meQuery.isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-3">
              <p className="text-muted-foreground text-sm">
                You haven&apos;t submitted predictions yet.
              </p>
            </CardContent>
          </Card>
        )}
        {!user && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-3 text-sm">
              <Link href={ROUTES.login} className="text-primary hover:underline">
                Sign in
              </Link>{' '}
              to see your rank.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="p-0">
          {isLoading ? (
            <LeaderboardSkeleton />
          ) : (
            <LeaderboardTable
              entries={entries}
              currentUsername={currentUsername}
              highlightedRank={highlightedRank}
            />
          )}
        </CardContent>
      </Card>

      {!isLoading && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          className="mb-8"
        />
      )}

      {user && hasRankedEntry && !isLoading && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 sm:hidden">
          <Button onClick={handleFindMyRank} className="shadow-lg">
            <Search className="mr-2 h-4 w-4" />
            Find My Rank (#{bannerRank})
          </Button>
        </div>
      )}
    </PageLayout>
  );
}
