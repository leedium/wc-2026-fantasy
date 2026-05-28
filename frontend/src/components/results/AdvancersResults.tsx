'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { ADVANCER_COUNT, ADVANCER_RANK_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Team, TournamentAdvancer } from '@/types/tournament';

export interface AdvancersResultsProps {
  advancers: TournamentAdvancer[];
  teams: Team[];
}

const RANKS = Array.from({ length: ADVANCER_COUNT }, (_, i) => i + 1);

export function AdvancersResults({ advancers, teams }: AdvancersResultsProps) {
  const teamById = React.useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );
  const teamByRank = React.useMemo(
    () => new Map(advancers.map((a) => [a.rank, a.teamId])),
    [advancers]
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {RANKS.map((rank) => {
        const teamId = teamByRank.get(rank) ?? null;
        const team = teamId ? (teamById.get(teamId) ?? null) : null;

        return (
          <Card
            key={rank}
            className={cn(team && 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10')}
            data-testid={`advancer-result-${rank}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{ADVANCER_RANK_LABELS[rank - 1]}</CardTitle>
                <Badge variant="secondary">#{rank}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {team ? (
                <span className="flex items-center gap-2 text-sm">
                  <TeamFlag code={team.code} />
                  <span className="truncate font-medium">{team.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    Group {team.group}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground text-sm italic">Pending</span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
