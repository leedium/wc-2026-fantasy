'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Lock, Search, Trophy, Users } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { PrizeTables } from '@/components/shared/PrizeTables';
import { UnpaidPredictionsTable } from '@/components/leaderboard/UnpaidPredictionsTable';
import { UnpaidPaymentNotice } from '@/components/predictions/UnpaidPaymentNotice';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from '@/components/shared/Pagination';
import { needsPayment } from '@/lib/predictions/paymentStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useTournamentLock } from '@/hooks/useTournamentLock';
import { PRIZE_RANK_CUTOFF, ROUTES } from '@/lib/constants';
import type { LeaderboardEntry, LeaderboardRankMatch } from '@/types/tournament';

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

interface PredictionsResponse {
  tournament: { id: string; lockTime: string };
  predictions: Array<{
    id: string;
    name: string;
    submittedAt: string | null;
    isPaid: boolean;
    groups: Array<{ groupId: string }>;
    advancers: Array<{ rank: number; teamId: string }>;
  }>;
}

export function LeaderboardPageContent() {
  const { user, profile } = useAuth();
  const { isLocked, phase, knockoutUnlocked } = useTournamentLock();
  // Phase 2 (knockout) pays the top 5; Phase 1 (group stage) pays the top 3.
  // Once the admin opens the knockout, flag 4th/5th as prize-winning rows.
  const prizeRankCutoff = knockoutUnlocked
    ? PRIZE_RANK_CUTOFF.phase2
    : PRIZE_RANK_CUTOFF.phase1;
  const activePrizePhase = knockoutUnlocked ? 'phase2' : 'phase1';
  const [currentPage, setCurrentPage] = React.useState(1);
  const [highlightedRank, setHighlightedRank] = React.useState<number | null>(null);
  // `search` tracks the input instantly; `debounced` (250ms) drives the fetch so
  // we don't hit the API on every keystroke. Mirrors AdminUsersList.
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const currentUsername = profile?.username ?? null;
  // Staff (admin or super-admin — the latter doesn't imply the former) can
  // always preview every bracket. Everyone else can preview others' entries in
  // two windows where picks are frozen: while the Group Stage is locked
  // (`phase1_locked`) and once the knockout bracket locks (`phase2_locked`).
  // It stays restricted while picks are still editable (`phase1` group picks,
  // `phase2_open` knockout picks) so a player can't copy a rival's in-progress
  // picks. Fails closed while the tournament query is loading (phase defaults
  // to phase1 → restricted).
  const isStaff = !!profile?.isAdmin || !!profile?.isSuperAdmin;
  const previewOthersLocked = !(phase === 'phase1_locked' || phase === 'phase2_locked');
  const canPreviewOthers = isStaff || !previewOthersLocked;
  // The leaderboard response shape depends on the viewer's identity:
  // admins get an extra `email` field, anon/auth users don't. Bake the
  // viewer kind into the cache key so logging in/out triggers a fresh
  // fetch instead of serving the previously-cached anon payload to a
  // newly-authenticated admin (and vice versa). Admin editors keep
  // invalidating by the prefix `['leaderboard', N]`, which still
  // matches the longer key.
  const viewerKey: 'admin' | 'auth' | 'anon' = profile?.isAdmin
    ? 'admin'
    : user
      ? 'auth'
      : 'anon';

  const query = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', currentPage, viewerKey, debounced],
    queryFn: async () => {
      const res = await fetch(
        `/api/leaderboard?page=${currentPage}&pageSize=${DEFAULT_ITEMS_PER_PAGE}&search=${encodeURIComponent(debounced)}`
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

  const meQuery = useQuery<{ matches: LeaderboardRankMatch[] }>({
    // Caller-scoped data — key on user.id so a different signed-in
    // user doesn't see the previous account's matches.
    queryKey: ['leaderboard-me', user?.id ?? null],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard/me?pageSize=${DEFAULT_ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error('Failed to fetch rank');
      return res.json();
    },
    enabled: !!user,
  });

  const bestMatch = React.useMemo(() => {
    const matches = meQuery.data?.matches ?? [];
    if (!matches.length) return null;
    return matches.reduce((best, m) => (m.rank < best.rank ? m : best), matches[0]);
  }, [meQuery.data]);

  // The public leaderboard only lists paid entries. Fetch the signed-in user's
  // own predictions (shared cache key with /predictions) so we can surface any
  // submitted-but-unpaid entries that are missing from the ranking below.
  const predictionsQuery = useQuery<PredictionsResponse>({
    queryKey: ['predictions'],
    queryFn: async () => {
      const res = await fetch('/api/predictions');
      if (!res.ok) throw new Error('Failed to fetch predictions');
      return res.json();
    },
    enabled: !!user,
  });

  // Mirror the leaderboard's own eligibility filter (submitted OR Phase-1
  // complete) so unpaid Phase 1 saved drafts surface here too.
  const unpaidPredictions = React.useMemo(
    () => (predictionsQuery.data?.predictions ?? []).filter(needsPayment),
    [predictionsQuery.data]
  );

  const handleFindMyRank = React.useCallback(() => {
    if (!bestMatch) return;
    const { rank, page } = bestMatch;
    if (currentPage !== page) setCurrentPage(page);
    setHighlightedRank(rank);
    setTimeout(() => {
      const el = document.getElementById(`rank-${rank}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    setTimeout(() => setHighlightedRank(null), 3000);
  }, [bestMatch, currentPage]);

  // Prefer server-reported rank so the banner shows even when the user is not on the current page.
  const bannerRank = bestMatch?.rank ?? userEntry?.rank ?? null;
  const bannerPoints = bestMatch?.points ?? userEntry?.points ?? null;
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
          <div className="text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span>{total.toLocaleString()} participants</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.results}>
              View live results
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
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
      </div>

      {!isStaff && previewOthersLocked && !isLoading && (
        <div className="border-muted-foreground/20 bg-muted/40 text-muted-foreground mb-6 flex items-start gap-2 rounded-md border px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="text-foreground font-medium">Heads up —</span>{' '}
            {phase === 'phase2_open' ? (
              <>
                brackets are private again while knockout picks are being made. Everyone&apos;s
                full bracket reopens for viewing once the knockout bracket locks. This keeps picks
                private while they can still be edited.
              </>
            ) : (
              <>
                you can preview only your own brackets for now. Other players&apos; group-stage
                picks open for viewing once the group stage locks. This keeps picks private while
                they can still be edited.
              </>
            )}
          </p>
        </div>
      )}

      {/* Hide the user's own unpaid-predictions surface while a search is active —
          it's noise unrelated to the filtered results. */}
      {user && !debounced && (
        <>
          <UnpaidPaymentNotice
            unpaidCount={unpaidPredictions.length}
            email={user.email ?? null}
          />
          <UnpaidPredictionsTable predictions={unpaidPredictions} isLocked={isLocked} />
        </>
      )}

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Prizes</h2>
          <Button variant="link" size="sm" asChild className="text-muted-foreground">
            <Link href={ROUTES.prizes}>
              Details
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <PrizeTables activePhase={activePrizePhase} />
      </section>

      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search player or prediction name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-9"
          aria-label="Search the leaderboard"
        />
      </div>

      <Card className="mb-6">
        <CardContent className="p-0">
          {isLoading ? (
            <LeaderboardSkeleton />
          ) : debounced && entries.length === 0 ? (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              No players match &ldquo;{debounced}&rdquo;.
            </p>
          ) : (
            <LeaderboardTable
              entries={entries}
              currentUsername={currentUsername}
              highlightedRank={highlightedRank}
              enablePreview={!!user}
              canPreviewOthers={canPreviewOthers}
              // Edit deep-link only while predictions are still editable.
              enableEdit={!!user && !isLocked}
              prizeRankCutoff={prizeRankCutoff}
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
