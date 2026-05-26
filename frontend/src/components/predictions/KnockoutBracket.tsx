'use client';

import * as React from 'react';
import { CheckCircle2, Circle, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { resolveTeamSource } from '@/lib/knockoutResolver';
import { cn } from '@/lib/utils';
import type {
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  KnockoutStage,
  R32BracketAssignment,
  Team,
} from '@/types/tournament';

// Stage display configuration. `pointsHint` is the per-match badge label.
// Round-of-32 picks aren't scored directly — they decide R16 slots — so the
// hint reflects that. Other rounds score the round's advancing teams (correct
// slot / wrong slot tiers); we surface that as a single hint per match card.
export const STAGE_CONFIG: Record<
  KnockoutStage,
  { label: string; shortLabel: string; pointsHint: string; subtitle: string }
> = {
  round_of_32: {
    label: 'Round of 32',
    shortLabel: 'R32',
    pointsHint: 'Sets R16 slot',
    subtitle: 'Picks here decide which teams sit in your Round of 16 slots — no direct points.',
  },
  round_of_16: {
    label: 'Round of 16',
    shortLabel: 'R16',
    pointsHint: '+5 / +3',
    subtitle: '+5 for each advancing team in the correct slot, +3 if right team but wrong slot.',
  },
  quarter_finals: {
    label: 'Quarter-finals',
    shortLabel: 'QF',
    pointsHint: '+6 / +3',
    subtitle: '+6 for each advancing team in the correct slot, +3 if right team but wrong slot.',
  },
  semi_finals: {
    label: 'Semi-finals',
    shortLabel: 'SF',
    pointsHint: '+8 / +4',
    subtitle: '+8 for each advancing team in the correct slot, +4 if right team but wrong slot.',
  },
  third_place: {
    label: 'Third Place',
    shortLabel: '3rd',
    pointsHint: '+5',
    subtitle: '+5 for predicting the third-place match winner correctly.',
  },
  final: {
    label: 'Final',
    shortLabel: 'Final',
    pointsHint: '+10 / +5 finalist · +15 champion',
    subtitle:
      'Each finalist scores +10 (correct slot) or +5 (wrong slot). Picking the champion correctly adds +15.',
  },
};

// Stage order. Used by the parent stepper; the bracket itself now renders one
// stage at a time controlled by the `stage` prop.
export const STAGE_ORDER: KnockoutStage[] = [
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'third_place',
  'final',
];

interface KnockoutBracketProps {
  matches: KnockoutMatch[];
  teams: Team[];
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
  bracketAssignments?: R32BracketAssignment[];
  onPredictionChange: (matchId: string, winnerId: string | null) => void;
  disabled?: boolean;
  stage: KnockoutStage;
}

// resolveTeamSource lives in @/lib/knockoutResolver so both this editor and
// the read-only BracketView can share it.

function getTeamDisplay(
  teamId: string | null,
  teams: Team[]
): { name: string; code: string } | null {
  if (!teamId) return null;
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;
  return { name: team.name, code: team.code };
}

// Friendly placeholder for an unresolved team source. 3rd-place slots
// (legacy "3-XXXXX" strings) read as "3rd-place team (TBD)" since FIFA
// decides bracket placement after group stage; group/match sources fall
// back to the raw source string.
function describeSource(source: string): string {
  if (/^3-[A-L]{5}$/.test(source)) return '3rd-place team (TBD)';
  return source;
}

// Single match card component
function MatchCard({
  match,
  team1Id,
  team2Id,
  teams,
  selectedWinnerId,
  onSelect,
  disabled,
}: {
  match: KnockoutMatch;
  team1Id: string | null;
  team2Id: string | null;
  teams: Team[];
  selectedWinnerId: string | null;
  onSelect: (winnerId: string | null) => void;
  disabled?: boolean;
}) {
  const team1 = getTeamDisplay(team1Id, teams);
  const team2 = getTeamDisplay(team2Id, teams);

  // Check if winner is still valid (team still advances to this match)
  const isWinnerValid =
    selectedWinnerId === null || selectedWinnerId === team1Id || selectedWinnerId === team2Id;

  // Auto-clear invalid selection when teams change
  React.useEffect(() => {
    if (selectedWinnerId && !isWinnerValid) {
      onSelect(null);
    }
  }, [selectedWinnerId, isWinnerValid, onSelect]);

  const effectiveWinnerId = isWinnerValid ? selectedWinnerId : null;
  const hasWinner = effectiveWinnerId !== null;
  const canSelect = team1Id !== null && team2Id !== null && !disabled;

  return (
    <Card
      className={cn(
        'w-full transition-colors',
        hasWinner && 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10'
      )}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-mono text-xs">{match.id}</span>
          <Badge variant="outline" className="text-xs">
            {STAGE_CONFIG[match.stage].pointsHint}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        {/* Team 1 */}
        <Button
          variant={effectiveWinnerId === team1Id && team1Id ? 'default' : 'outline'}
          className={cn('h-auto w-full justify-start px-3 py-2', !team1 && 'text-muted-foreground')}
          disabled={!canSelect || !team1Id}
          onClick={() => onSelect(team1Id)}
        >
          {team1 ? (
            <span className="flex w-full items-center gap-2">
              <TeamFlag code={team1.code} />
              <span className="font-mono text-xs">{team1.code}</span>
              <span className="flex-1 truncate text-left text-sm">{team1.name}</span>
              {effectiveWinnerId === team1Id && <Trophy className="h-4 w-4 text-yellow-500" />}
            </span>
          ) : (
            <span className="text-xs">TBD · {describeSource(match.team1Source)}</span>
          )}
        </Button>

        {/* VS divider */}
        <div className="text-muted-foreground text-center text-xs">vs</div>

        {/* Team 2 */}
        <Button
          variant={effectiveWinnerId === team2Id && team2Id ? 'default' : 'outline'}
          className={cn('h-auto w-full justify-start px-3 py-2', !team2 && 'text-muted-foreground')}
          disabled={!canSelect || !team2Id}
          onClick={() => onSelect(team2Id)}
        >
          {team2 ? (
            <span className="flex w-full items-center gap-2">
              <TeamFlag code={team2.code} />
              <span className="font-mono text-xs">{team2.code}</span>
              <span className="flex-1 truncate text-left text-sm">{team2.name}</span>
              {effectiveWinnerId === team2Id && <Trophy className="h-4 w-4 text-yellow-500" />}
            </span>
          ) : (
            <span className="text-xs">TBD · {describeSource(match.team2Source)}</span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// Stage section component
function StageSection({
  stage,
  matches,
  allMatches,
  teams,
  groupPredictions,
  knockoutPredictions,
  bracketAssignments,
  onPredictionChange,
  disabled,
}: {
  stage: KnockoutStage;
  matches: KnockoutMatch[];
  allMatches: KnockoutMatch[];
  teams: Team[];
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
  bracketAssignments: R32BracketAssignment[];
  onPredictionChange: (matchId: string, winnerId: string | null) => void;
  disabled?: boolean;
}) {
  const config = STAGE_CONFIG[stage];
  const completedCount = matches.filter((match) => {
    const prediction = knockoutPredictions.find((p) => p.matchId === match.id);
    return prediction?.winnerId !== null && prediction?.winnerId !== undefined;
  }).length;

  return (
    <div className="space-y-4">
      {/* Stage header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-semibold">{config.label}</h4>
          <p className="text-muted-foreground text-sm">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'} · {config.subtitle}
          </p>
        </div>
        {completedCount === matches.length ? (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Complete
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Circle className="mr-1 h-3 w-3" />
            {completedCount}/{matches.length}
          </Badge>
        )}
      </div>

      {/* Matches grid */}
      <div
        className={cn(
          'grid gap-3',
          matches.length === 1
            ? 'mx-auto max-w-sm grid-cols-1'
            : matches.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : matches.length <= 4
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                : matches.length <= 8
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4'
        )}
      >
        {matches.map((match) => {
          const team1Id = resolveTeamSource(
            match.team1Source,
            allMatches,
            groupPredictions,
            knockoutPredictions,
            bracketAssignments
          );
          const team2Id = resolveTeamSource(
            match.team2Source,
            allMatches,
            groupPredictions,
            knockoutPredictions,
            bracketAssignments
          );
          const prediction = knockoutPredictions.find((p) => p.matchId === match.id);
          const selectedWinnerId = prediction?.winnerId ?? null;

          return (
            <MatchCard
              key={match.id}
              match={match}
              team1Id={team1Id}
              team2Id={team2Id}
              teams={teams}
              selectedWinnerId={selectedWinnerId}
              onSelect={(winnerId) => onPredictionChange(match.id, winnerId)}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
}

export function KnockoutBracket({
  matches,
  teams,
  groupPredictions,
  knockoutPredictions,
  bracketAssignments = [],
  onPredictionChange,
  disabled = false,
  stage,
}: KnockoutBracketProps) {
  const stageMatches = React.useMemo(
    () => matches.filter((m) => m.stage === stage),
    [matches, stage]
  );

  const totalMatches = matches.length;
  const completedMatches = knockoutPredictions.filter((p) => p.winnerId !== null).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Knockout Bracket</h3>
        <Badge variant={completedMatches === totalMatches ? 'default' : 'secondary'}>
          {completedMatches} / {totalMatches} matches predicted
        </Badge>
      </div>

      {/* How is this scored? — collapsible, opens by default. */}
      <details
        className="group bg-muted/40 rounded-md border px-4 py-3 open:pb-4"
        open
      >
        <summary className="cursor-pointer list-none text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground transition-transform group-open:rotate-90">▶</span>
            How is this scored?
          </span>
        </summary>
        <div className="text-muted-foreground mt-3 space-y-2 text-sm">
          <p>
            Click a team to pick the winner of each match. Winners automatically advance to the next
            round. Complete your group predictions first to see teams in Round of 32.
          </p>
          <p>
            <strong>Round of 32 picks aren&apos;t scored directly</strong> — they decide which
            teams sit in your Round of 16 slots. From R16 onward, each advancing team scores in the
            higher tier if you picked the right winner of the deciding match, the lower tier if you
            picked them to win some other match in the same stage, otherwise 0.
          </p>
          <p>
            <strong>Per advancing team:</strong> R16 +5/+3 · QF +6/+3 · SF +8/+4 · Final +10/+5
          </p>
          <p>
            <strong>Bonuses:</strong> +15 for the World Cup champion · +5 for the third-place
            match winner.
          </p>
        </div>
      </details>

      {/* Persistent scoring summary. */}
      <div className="text-muted-foreground bg-muted/20 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 font-mono text-xs">
        <span>R16 +5/+3</span>
        <span>·</span>
        <span>QF +6/+3</span>
        <span>·</span>
        <span>SF +8/+4</span>
        <span>·</span>
        <span>Final +10/+5</span>
        <span>·</span>
        <span>Champion +15</span>
        <span>·</span>
        <span>3rd-place +5</span>
      </div>

      <StageSection
        stage={stage}
        matches={stageMatches}
        allMatches={matches}
        teams={teams}
        groupPredictions={groupPredictions}
        knockoutPredictions={knockoutPredictions}
        bracketAssignments={bracketAssignments}
        onPredictionChange={onPredictionChange}
        disabled={disabled}
      />
    </div>
  );
}
