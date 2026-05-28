'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageLayout } from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { BracketView } from '@/components/predictions/BracketView';
import { GroupStandingsResults } from '@/components/results/GroupStandingsResults';
import { AdvancersResults } from '@/components/results/AdvancersResults';
import type {
  Group,
  GroupStanding,
  KnockoutMatch,
  R32BracketAssignment,
  Team,
  TournamentAdvancer,
} from '@/types/tournament';

interface KnockoutResultRow {
  matchId: string;
  winnerTeamId: string | null;
  loserTeamId: string | null;
  totalGoals: number | null;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ResultsPageContent() {
  const teamsQuery = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchJSON('/api/teams'),
  });
  const groupsQuery = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => fetchJSON('/api/groups'),
  });
  const matchesQuery = useQuery<KnockoutMatch[]>({
    queryKey: ['knockout-matches'],
    queryFn: () => fetchJSON('/api/knockout-matches'),
  });
  const standingsQuery = useQuery<{ standings: GroupStanding[] }>({
    queryKey: ['group-standings'],
    queryFn: () => fetchJSON('/api/group-standings'),
  });
  const advancersQuery = useQuery<{ advancers: TournamentAdvancer[] }>({
    queryKey: ['advancers'],
    queryFn: () => fetchJSON('/api/advancers'),
  });
  const resultsQuery = useQuery<{ results: KnockoutResultRow[] }>({
    queryKey: ['knockout-results'],
    queryFn: () => fetchJSON('/api/knockout-results'),
  });
  const bracketQuery = useQuery<{ assignments: R32BracketAssignment[] }>({
    queryKey: ['r32-bracket'],
    queryFn: () => fetchJSON('/api/r32-bracket'),
  });

  const teams = teamsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const standings = standingsQuery.data?.standings ?? [];
  const advancers = advancersQuery.data?.advancers ?? [];
  const bracketAssignments = bracketQuery.data?.assignments ?? [];

  // The bracket reflects real outcomes: feed admin-entered standings as the
  // group source and knockout_results as the match winners. resolveTeamSource
  // reads 1A/2B group sources from groupPredictions, so the actual top-2 drive
  // who appears in each Round-of-32 slot.
  const groupPredictions = React.useMemo(
    () =>
      (standingsQuery.data?.standings ?? []).map((s) => ({
        groupId: s.groupId,
        positions: {
          first: s.firstTeamId,
          second: s.secondTeamId,
          third: s.thirdTeamId,
          fourth: s.fourthTeamId,
        },
      })),
    [standingsQuery.data]
  );
  const knockoutPredictions = React.useMemo(
    () =>
      (resultsQuery.data?.results ?? []).map((r) => ({
        matchId: r.matchId,
        winnerId: r.winnerTeamId,
      })),
    [resultsQuery.data]
  );

  // Core metadata must load before anything can render meaningfully.
  const ready = teamsQuery.data && groupsQuery.data && matchesQuery.data;
  const isError = teamsQuery.isError || groupsQuery.isError || matchesQuery.isError;

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Results</h1>
        <p className="text-muted-foreground">
          The official tournament outcomes as entered by the pool admin. This view is
          read-only and updates as new results are posted.
        </p>
      </div>

      {isError && (
        <p className="text-destructive text-sm" role="alert">
          Couldn&apos;t load the tournament results. Please try again.
        </p>
      )}

      {!ready && !isError && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {ready && (
        <div className="space-y-10">
          <Section
            title="Group stage"
            description="Final standings for all 12 groups. The top two in each group advance to the Round of 32."
          >
            <GroupStandingsResults groups={groups} teams={teams} standings={standings} />
          </Section>

          <Section
            title="Best 3rd-place advancers"
            description="The 8 best third-placed teams that fill the remaining Round-of-32 spots, ranked best first."
          >
            <AdvancersResults advancers={advancers} teams={teams} />
          </Section>

          <Section
            title="Knockout bracket"
            description="Match winners from the Round of 32 through the final. Empty slots show as TBD until results are posted."
          >
            <BracketView
              matches={matches}
              teams={teams}
              groupPredictions={groupPredictions}
              knockoutPredictions={knockoutPredictions}
              bracketAssignments={bracketAssignments}
            />
          </Section>
        </div>
      )}
    </PageLayout>
  );
}
