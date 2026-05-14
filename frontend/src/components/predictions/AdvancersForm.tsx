'use client';

import * as React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { ADVANCER_COUNT, ADVANCER_RANK_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { AdvancerPrediction, Team } from '@/types/tournament';

export interface AdvancersFormProps {
  /**
   * 'predict' for the user wizard (candidate pool = user's own 3rd-place
   * group picks); 'admin' for the admin results page (candidate pool =
   * actual 3rd-place finishers from admin-entered group_standings). The
   * caller assembles the pool either way and passes it via `candidatePool`.
   */
  variant: 'predict' | 'admin';
  /** The 12 (or fewer) 3rd-place teams the user / admin is picking from. */
  candidatePool: Team[];
  /** Current ranked picks. */
  value: AdvancerPrediction[];
  /** Called when a rank's team changes (null to clear). */
  onRankChange: (rank: number, teamId: string | null) => void;
  disabled?: boolean;
}

const RANKS = Array.from({ length: ADVANCER_COUNT }, (_, i) => i + 1);

// Sentinel for the "(none)" entry so admins/users can clear a rank.
// Radix Select forbids empty string values, so a non-empty marker is needed.
const CLEAR_VALUE = '__CLEAR__';

export function AdvancersForm({
  variant,
  candidatePool,
  value,
  onRankChange,
  disabled = false,
}: AdvancersFormProps) {
  const filledCount = value.filter((v) => !!v.teamId).length;
  const isComplete = filledCount === ADVANCER_COUNT;
  const pickedTeamIds = new Set(value.filter((v) => v.teamId).map((v) => v.teamId));
  const poolIncomplete = candidatePool.length < ADVANCER_COUNT;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {variant === 'admin' ? 'Top-8 3rd-place advancers' : 'Best 3rd-place picks'}
        </h3>
        <Badge variant={isComplete ? 'default' : 'secondary'}>
          {filledCount} / {ADVANCER_COUNT} ranks complete
        </Badge>
      </div>

      <details className="group bg-muted/40 rounded-md border px-4 py-3 open:pb-4" open>
        <summary className="cursor-pointer list-none text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground transition-transform group-open:rotate-90">▶</span>
            How is this scored?
          </span>
        </summary>
        <div className="text-muted-foreground mt-3 space-y-2 text-sm">
          {variant === 'predict' ? (
            <>
              <p>
                FIFA 2026 advances the 8 best of the 12 third-placed teams to the Round of 32.
                Pick 8 teams from your group-stage 3rd-place picks and rank them &mdash; best
                first.
              </p>
              <p>
                <strong>Per pick:</strong> +1 if your team is in the actual top 8;
                additional +0.25 if it&apos;s at the exact rank. Max <strong>+10 points</strong>{' '}
                across all 8 ranks.
              </p>
            </>
          ) : (
            <p>
              Pick the 8 best 3rd-place teams in descending order. Choices are limited to
              the teams you&apos;ve recorded as 3rd-place finishers in the group standings.
            </p>
          )}
        </div>
      </details>

      {variant === 'predict' && poolIncomplete && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <strong>Heads up:</strong> only {candidatePool.length} of 12 group 3rd-place picks
          are filled in. Finish the group stage first so all 12 candidates are available here.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {RANKS.map((rank) => {
          const pick = value.find((v) => v.rank === rank);
          const filled = !!pick?.teamId;
          const pickedTeam = filled
            ? candidatePool.find((t) => t.id === pick!.teamId) ?? null
            : null;

          return (
            <Card
              key={rank}
              className={cn(filled && 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10')}
              data-testid={`advancer-rank-${rank}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ADVANCER_RANK_LABELS[rank - 1]}</CardTitle>
                  {filled ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Set
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Circle className="mr-1 h-3 w-3" />
                      0/1
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">Rank #{rank}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={pick?.teamId ?? ''}
                  onValueChange={(value) => {
                    if (value === CLEAR_VALUE) {
                      onRankChange(rank, null);
                      return;
                    }
                    onRankChange(rank, value || null);
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {filled && (
                      <SelectItem value={CLEAR_VALUE}>
                        <span className="text-muted-foreground">(none)</span>
                      </SelectItem>
                    )}
                    {candidatePool.map((team) => {
                      const isOwnPick = pick?.teamId === team.id;
                      const isUsedElsewhere = !isOwnPick && pickedTeamIds.has(team.id);
                      return (
                        <SelectItem
                          key={team.id}
                          value={team.id}
                          disabled={isUsedElsewhere}
                        >
                          <span className="flex items-center gap-2">
                            <TeamFlag code={team.code} />
                            <span>{team.name}</span>
                            <span className="text-muted-foreground text-xs">({team.code})</span>
                            {isUsedElsewhere && (
                              <span className="text-muted-foreground ml-1 text-xs italic">
                                (already picked)
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {pickedTeam && (
                  <p className="text-muted-foreground text-xs">
                    Your pick:{' '}
                    <span className="text-foreground font-medium">{pickedTeam.name}</span>{' '}
                    from Group {pickedTeam.group}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
