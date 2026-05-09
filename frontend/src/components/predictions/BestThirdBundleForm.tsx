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
import { BUNDLE_SLOTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { BundlePrediction, GroupPrediction, Team } from '@/types/tournament';

interface BestThirdBundleFormProps {
  /** All teams (for previewing the user's predicted 3rd from each candidate group). */
  teams: Team[];
  /** User's group predictions — used to preview the 3rd-place team that each candidate represents. */
  groupPredictions: GroupPrediction[];
  /** User's current bundle picks. */
  bundlePredictions: BundlePrediction[];
  onBundleChange: (slotIndex: number, groupLetter: string | null) => void;
  disabled?: boolean;
}

function predictedThirdTeam(
  groupLetter: string,
  groupPredictions: GroupPrediction[],
  teams: Team[]
): Team | null {
  const group = groupPredictions.find((g) => g.groupId === groupLetter);
  const teamId = group?.positions.third ?? null;
  if (!teamId) return null;
  return teams.find((t) => t.id === teamId) ?? null;
}

export function BestThirdBundleForm({
  teams,
  groupPredictions,
  bundlePredictions,
  onBundleChange,
  disabled = false,
}: BestThirdBundleFormProps) {
  const completedCount = bundlePredictions.filter((b) => !!b.groupLetter).length;
  const isComplete = completedCount === BUNDLE_SLOTS.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Best 3rd-place picks</h3>
        <Badge variant={isComplete ? 'default' : 'secondary'}>
          {completedCount} / {BUNDLE_SLOTS.length} bundles complete
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
          <p>
            FIFA 2026 advances the 8 best of the 12 third-placed teams to the Round of 32.
            Each of those 8 R32 slots is pre-bound to a 5-group bundle (e.g. <em>Best 3rd of
            A/B/C/D/F</em> feeds R32 match M2). Pick which group&apos;s 3rd-place team you
            think will be the best of that bundle.
          </p>
          <p>
            <strong>Per bundle:</strong> +0.5 points if your predicted group letter matches
            the team that actually advances. Max <strong>+4 points</strong> across all 8
            bundles.
          </p>
        </div>
      </details>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {BUNDLE_SLOTS.map((slot) => {
          const pick = bundlePredictions.find((b) => b.slotIndex === slot.slotIndex);
          const filled = !!pick?.groupLetter;
          const previewTeam = pick?.groupLetter
            ? predictedThirdTeam(pick.groupLetter, groupPredictions, teams)
            : null;

          return (
            <Card
              key={slot.slotIndex}
              className={cn(filled && 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10')}
              data-testid={`bundle-slot-${slot.slotIndex}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Best 3rd of {slot.allowedLetters.join('/')}
                  </CardTitle>
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
                <p className="text-muted-foreground text-xs">
                  Feeds R32 match {slot.r32MatchId}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={pick?.groupLetter ?? ''}
                  onValueChange={(value) => onBundleChange(slot.slotIndex, value || null)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {slot.allowedLetters.map((letter) => {
                      const team = predictedThirdTeam(letter, groupPredictions, teams);
                      return (
                        <SelectItem key={letter} value={letter}>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-xs">Group {letter}</span>
                            {team ? (
                              <>
                                <TeamFlag code={team.code} />
                                <span className="text-muted-foreground text-xs">
                                  ({team.code})
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">
                                (3rd-place pick missing)
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {previewTeam && (
                  <p className="text-muted-foreground text-xs">
                    Your pick:{' '}
                    <span className="text-foreground font-medium">{previewTeam.name}</span> as
                    Group {pick?.groupLetter}&apos;s 3rd
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
