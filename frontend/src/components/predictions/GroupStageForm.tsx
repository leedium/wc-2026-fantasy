'use client';

import * as React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { cn } from '@/lib/utils';
import type { Group, GroupPrediction, Team } from '@/types/tournament';

// Sentinel value for the admin-only "(none)" SelectItem. Radix Select forbids
// empty-string item values, so we route this through onValueChange and translate
// it back to null when calling onPositionChange.
const CLEAR_VALUE = '__CLEAR__';

// Position labels for display
const POSITION_LABELS = {
  first: '1st',
  second: '2nd',
  third: '3rd',
  fourth: '4th',
} as const;

export type GroupPositionKey = keyof typeof POSITION_LABELS;

interface GroupStageFormProps {
  groups: Group[];
  predictions: GroupPrediction[];
  onPredictionChange: (
    groupId: string,
    position: GroupPositionKey,
    teamId: string | null
  ) => void;
  disabled?: boolean;
  /**
   * Variant: 'predict' (default) is the user-side wizard with scoring tips.
   * 'admin' hides the scoring tips and renames the heading; admins also
   * typically pass `extraPerCard` to inject a Save button + submitted badge.
   */
  variant?: 'predict' | 'admin';
  /** Optional render-prop appended inside each group card (e.g., a Save row). */
  extraPerCard?: (groupId: string) => React.ReactNode;
  /**
   * Predict-variant only: when provided, renders an "Auto-fill by FIFA ranking"
   * button in the header that overwrites all 12 groups with rank-ordered picks.
   */
  onAutofillByFifaRanking?: () => void;
  /**
   * Predict-variant only: when provided, renders a "Reset" button that clears
   * every position in every group back to the unselected state.
   */
  onResetGroups?: () => void;
}

// Local alias for the existing internal usage.
type PositionKey = GroupPositionKey;

// Single group card component
function GroupCard({
  group,
  prediction,
  onPositionChange,
  disabled,
  extra,
  showClear,
}: {
  group: Group;
  prediction: GroupPrediction;
  onPositionChange: (position: PositionKey, teamId: string | null) => void;
  disabled?: boolean;
  extra?: React.ReactNode;
  showClear?: boolean;
}) {
  // Get selected team IDs for this group
  const selectedTeamIds = new Set(
    Object.values(prediction.positions).filter((id): id is string => id !== null)
  );

  // Check if group is complete (all 4 positions filled)
  const isComplete = selectedTeamIds.size === 4;

  // When 1, 2, 3 are all picked, the 4th is forced to the one leftover team —
  // the user can't pick it (or anything else) for that slot.
  const { first, second, third } = prediction.positions;
  const top3AllFilled = !!(first && second && third);
  const top3Ids = new Set<string>([first, second, third].filter((v): v is string => !!v));
  const autoFillFourth = top3AllFilled
    ? (group.teams.find((t) => !top3Ids.has(t.id)) ?? null)
    : null;

  React.useEffect(() => {
    if (disabled) return;
    if (autoFillFourth && prediction.positions.fourth !== autoFillFourth.id) {
      onPositionChange('fourth', autoFillFourth.id);
    }
    // We deliberately don't auto-clear `fourth` when top-3 is incomplete —
    // the user may have started by picking the 4th first; the existing
    // `getAvailableTeams` logic keeps that consistent.
  }, [autoFillFourth, disabled, prediction.positions.fourth, onPositionChange]);

  // Every team in the group is selectable from every position's dropdown.
  // Picking a team that's already in another slot swaps the two — handled by
  // the parent's onPredictionChange (it detects the conflict and reassigns).
  const availableTeams: Team[] = group.teams;

  return (
    <Card className={cn(isComplete && 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{group.name}</CardTitle>
          {isComplete ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Complete
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Circle className="mr-1 h-3 w-3" />
              {selectedTeamIds.size}/4
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(POSITION_LABELS) as PositionKey[]).map((position) => {
          const selectedValue = prediction.positions[position];
          const isAutoFilled = position === 'fourth' && autoFillFourth !== null;

          return (
            <div key={position} className="flex items-center gap-3">
              <span className="text-muted-foreground w-10 text-sm font-medium">
                {POSITION_LABELS[position]}
              </span>
              <Select
                value={selectedValue ?? ''}
                onValueChange={(value) =>
                  onPositionChange(position, value === CLEAR_VALUE ? null : value || null)
                }
                disabled={disabled || isAutoFilled}
              >
                <SelectTrigger
                  className="flex-1"
                  title={isAutoFilled ? 'Auto-filled from your top 3 picks' : undefined}
                >
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {showClear && !isAutoFilled && selectedValue ? (
                    <SelectItem value={CLEAR_VALUE}>
                      <span className="text-muted-foreground">(none)</span>
                    </SelectItem>
                  ) : null}
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <span className="flex items-center gap-2">
                        <TeamFlag code={team.code} />
                        <span className="text-muted-foreground font-mono text-xs">{team.code}</span>
                        <span>{team.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
        {extra ? <div className="border-t pt-3">{extra}</div> : null}
      </CardContent>
    </Card>
  );
}

export function GroupStageForm({
  groups,
  predictions,
  onPredictionChange,
  disabled = false,
  variant = 'predict',
  extraPerCard,
  onAutofillByFifaRanking,
  onResetGroups,
}: GroupStageFormProps) {
  const isAdmin = variant === 'admin';
  const showAutofill = !isAdmin && !!onAutofillByFifaRanking && !disabled;
  const showReset = !isAdmin && !!onResetGroups && !disabled;
  const showActions = showAutofill || showReset;

  // Calculate completion stats
  const completedGroups = predictions.filter((p) => {
    const filledPositions = Object.values(p.positions).filter((v) => v !== null).length;
    return filledPositions === 4;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isAdmin ? 'Group Standings' : 'Group Stage Predictions'}
        </h3>
        <Badge variant={completedGroups === 12 ? 'default' : 'secondary'}>
          {completedGroups} / 12 groups {isAdmin ? 'filled in' : 'complete'}
        </Badge>
      </div>

      {!isAdmin && (
        <details className="group bg-muted/40 rounded-md border px-4 py-3 open:pb-4" open>
          <summary className="cursor-pointer list-none text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground transition-transform group-open:rotate-90">▶</span>
              How is this scored?
            </span>
          </summary>
          <div className="text-muted-foreground mt-3 space-y-2 text-sm">
            <p>
              Predict the final standings for each group: who finishes 1st, 2nd, 3rd, and 4th. Each
              team can only be selected once per group.
            </p>
            <p>
              <strong>Scoring uses only the top two finishers.</strong> 3rd and 4th picks
              aren&apos;t scored as part of the group total; your 3rd-place picks feed the
              separate Best 3rds step.
            </p>
            <p>
              <strong>Per group:</strong> +12 for both top-two correct in exact order · +8 if
              both correct but swapped · +5 per correct team in its correct slot · 0 otherwise.
              Right team in the wrong slot does not score.
            </p>
            <p>
              <strong>Group I (&ldquo;Group of Death&rdquo;)</strong> pays +18 instead of +12
              when both top-two finishers are predicted in exact order.
            </p>
          </div>
        </details>
      )}

      {showActions && (
        <div className="flex items-center justify-between gap-2">
          {showAutofill ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onAutofillByFifaRanking}
            >
              Auto-fill by FIFA ranking
            </Button>
          ) : (
            <span />
          )}
          {showReset && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onResetGroups}
            >
              Reset
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((group) => {
          const prediction = predictions.find((p) => p.groupId === group.id);
          if (!prediction) return null;

          return (
            <GroupCard
              key={group.id}
              group={group}
              prediction={prediction}
              onPositionChange={(position, teamId) =>
                onPredictionChange(group.id, position, teamId)
              }
              disabled={disabled}
              extra={extraPerCard?.(group.id)}
              showClear={isAdmin}
            />
          );
        })}
      </div>
    </div>
  );
}
