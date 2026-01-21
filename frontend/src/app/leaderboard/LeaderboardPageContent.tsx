'use client';

import * as React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Search, Trophy, Users } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { mockLeaderboard } from '@/lib/mock-data';
import type { LeaderboardEntry } from '@/types/tournament';

/** Loading skeleton for leaderboard table */
function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-4 py-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Row skeletons */}
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

export function LeaderboardPageContent() {
  const { publicKey, connected } = useWallet();
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [highlightedRank, setHighlightedRank] = React.useState<number | null>(null);
  const [leaderboardData, setLeaderboardData] = React.useState<LeaderboardEntry[]>([]);

  const currentUserWallet = publicKey?.toBase58() ?? null;

  // Simulate loading state for mock data
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLeaderboardData(mockLeaderboard);
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Find current user's entry
  const userEntry = React.useMemo(() => {
    if (!currentUserWallet) return null;
    return leaderboardData.find(
      (entry) => entry.wallet.toLowerCase() === currentUserWallet.toLowerCase()
    );
  }, [leaderboardData, currentUserWallet]);

  // Pagination
  const totalEntries = leaderboardData.length;
  const totalPages = Math.ceil(totalEntries / DEFAULT_ITEMS_PER_PAGE);
  const paginatedEntries = React.useMemo(() => {
    const startIndex = (currentPage - 1) * DEFAULT_ITEMS_PER_PAGE;
    const endIndex = startIndex + DEFAULT_ITEMS_PER_PAGE;
    return leaderboardData.slice(startIndex, endIndex);
  }, [leaderboardData, currentPage]);

  // Handle "Find My Rank" click
  const handleFindMyRank = React.useCallback(() => {
    if (!userEntry) return;

    // Calculate which page the user is on
    const userIndex = leaderboardData.findIndex(
      (entry) => entry.wallet.toLowerCase() === currentUserWallet?.toLowerCase()
    );

    if (userIndex === -1) return;

    const userPage = Math.floor(userIndex / DEFAULT_ITEMS_PER_PAGE) + 1;

    // Navigate to the user's page if not already there
    if (currentPage !== userPage) {
      setCurrentPage(userPage);
    }

    // Set highlighted rank to trigger visual highlight
    setHighlightedRank(userEntry.rank);

    // Scroll to user's row after a short delay (to allow page change)
    setTimeout(() => {
      const element = document.getElementById(`rank-${userEntry.rank}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // Clear highlight after animation
    setTimeout(() => {
      setHighlightedRank(null);
    }, 3000);
  }, [userEntry, leaderboardData, currentUserWallet, currentPage]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Clear highlight when changing pages
    setHighlightedRank(null);
  };

  return (
    <PageLayout>
      {/* User Rank Banner (sticky, shown if connected and ranked) */}
      {connected && userEntry && (
        <div className="bg-primary/10 border-primary/20 sticky top-16 z-40 -mx-4 mb-6 border-y px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="text-primary h-5 w-5" />
              <div>
                <p className="text-sm font-medium">Your Rank</p>
                <p className="text-primary text-lg font-bold">#{userEntry.rank}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">Points</p>
                <p className="font-semibold">{userEntry.points} pts</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleFindMyRank}>
                <Search className="mr-2 h-4 w-4" />
                Find Me
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span>{totalEntries.toLocaleString()} participants</span>
            )}
          </p>
        </div>
        {connected && !userEntry && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-3">
              <p className="text-muted-foreground text-sm">
                You haven&apos;t submitted predictions yet.
              </p>
            </CardContent>
          </Card>
        )}
        {!connected && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-3">
              <p className="text-muted-foreground text-sm">Connect your wallet to see your rank.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leaderboard Table */}
      <Card className="mb-6">
        <CardContent className="p-0">
          {isLoading ? (
            <LeaderboardSkeleton />
          ) : (
            <LeaderboardTable
              entries={paginatedEntries}
              currentUserWallet={currentUserWallet}
              highlightedRank={highlightedRank}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          className="mb-8"
        />
      )}

      {/* Find My Rank Button (mobile, shown at bottom) */}
      {connected && userEntry && !isLoading && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 sm:hidden">
          <Button onClick={handleFindMyRank} className="shadow-lg">
            <Search className="mr-2 h-4 w-4" />
            Find My Rank (#{userEntry.rank})
          </Button>
        </div>
      )}
    </PageLayout>
  );
}
