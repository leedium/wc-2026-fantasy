'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { cn } from '@/lib/utils';
import type { Group, GroupStanding, Team } from '@/types/tournament';

export interface GroupStandingsResultsProps {
  groups: Group[];
  teams: Team[];
  standings: GroupStanding[];
  /**
   * Show the per-group "Final"/"Pending" status badge. Defaults to true for
   * the official /results view. Set false when rendering a user's predictions
   * (e.g. the bracket preview), where that results-only status has no meaning.
   */
  showStatusBadge?: boolean;
}

const POSITIONS = [
  { key: 'firstTeamId', label: '1st' },
  { key: 'secondTeamId', label: '2nd' },
  { key: 'thirdTeamId', label: '3rd' },
  { key: 'fourthTeamId', label: '4th' },
] as const;

export function GroupStandingsResults({
  groups,
  teams,
  standings,
  showStatusBadge = true,
}: GroupStandingsResultsProps) {
  const teamById = React.useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );
  const standingByGroup = React.useMemo(
    () => new Map(standings.map((s) => [s.groupId, s])),
    [standings]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {groups.map((group) => {
        const standing = standingByGroup.get(group.id) ?? null;
        const posted = !!standing;

        return (
          <Card key={group.id} data-testid={`group-result-${group.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{group.name}</CardTitle>
                {showStatusBadge &&
                  (posted ? (
                    <Badge variant="default" className="bg-green-600">
                      Final
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {POSITIONS.map(({ key, label }, idx) => {
                const teamId = standing ? standing[key] : null;
                const team = teamId ? (teamById.get(teamId) ?? null) : null;
                // Top two finishers advance straight to the Round of 32.
                const advances = idx < 2;

                return (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                      advances && team && 'bg-primary/5'
                    )}
                  >
                    <span className="text-muted-foreground w-7 shrink-0 text-xs font-medium">
                      {label}
                    </span>
                    {team ? (
                      <>
                        <TeamFlag code={team.code} />
                        <span className="truncate font-medium">{team.name}</span>
                        <span className="text-muted-foreground ml-auto font-mono text-xs">
                          {team.code}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
