'use client';

import * as React from 'react';
import { CheckCircle2, Circle, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { cn } from '@/lib/utils';
import type {
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  KnockoutStage,
  Team,
} from '@/types/tournament';

// Stage display configuration. `pointsHint` is the per-match badge label.
// Round-of-32 picks aren't scored directly — they decide R16 slots — so the
// hint reflects that. Other rounds score the round's advancing teams (correct
// slot / wrong slot tiers); we surface that as a single hint per match card.
const STAGE_CONFIG: Record<
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

// Stage order for tabs
const STAGE_ORDER: KnockoutStage[] = [
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'final',
  'third_place',
];

interface KnockoutBracketProps {
  matches: KnockoutMatch[];
  teams: Team[];
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
  onPredictionChange: (matchId: string, winnerId: string | null) => void;
  disabled?: boolean;
}

// Helper to resolve a team source to team ID or null
function resolveTeamSource(
  source: string,
  matches: KnockoutMatch[],
  groupPredictions: GroupPrediction[],
  knockoutPredictions: KnockoutMatchPrediction[]
): string | null {
  // Group position source (e.g., "1A" = 1st place in Group A, "2B" = 2nd place in Group B)
  const groupMatch = source.match(/^([123])([A-L])$/);
  if (groupMatch) {
    const [, position, groupId] = groupMatch;
    const groupPrediction = groupPredictions.find((p) => p.groupId === groupId);
    if (!groupPrediction) return null;

    switch (position) {
      case '1':
        return groupPrediction.positions.first;
      case '2':
        return groupPrediction.positions.second;
      case '3':
        return groupPrediction.positions.third;
      default:
        return null;
    }
  }

  // Match winner source (e.g., "M1" = winner of match M1)
  const matchWinnerMatch = source.match(/^M(\d+)$/);
  if (matchWinnerMatch) {
    const matchPrediction = knockoutPredictions.find((p) => p.matchId === source);
    return matchPrediction?.winnerId ?? null;
  }

  // Match loser source (e.g., "L-M29" = loser of match M29)
  const matchLoserMatch = source.match(/^L-M(\d+)$/);
  if (matchLoserMatch) {
    const matchId = `M${matchLoserMatch[1]}`;
    const matchPrediction = knockoutPredictions.find((p) => p.matchId === matchId);
    const match = matches.find((m) => m.id === matchId);
    if (!matchPrediction?.winnerId || !match) return null;

    const team1Id = resolveTeamSource(
      match.team1Source,
      matches,
      groupPredictions,
      knockoutPredictions
    );
    const team2Id = resolveTeamSource(
      match.team2Source,
      matches,
      groupPredictions,
      knockoutPredictions
    );

    if (matchPrediction.winnerId === team1Id) return team2Id;
    if (matchPrediction.winnerId === team2Id) return team1Id;
    return null;
  }

  return null;
}

function getTeamDisplay(
  teamId: string | null,
  teams: Team[]
): { name: string; code: string } | null {
  if (!teamId) return null;
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;
  return { name: team.name, code: team.code };
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
            <span className="text-xs">TBD ({match.team1Source})</span>
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
            <span className="text-xs">TBD ({match.team2Source})</span>
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
  onPredictionChange,
  disabled,
}: {
  stage: KnockoutStage;
  matches: KnockoutMatch[];
  allMatches: KnockoutMatch[];
  teams: Team[];
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
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
            knockoutPredictions
          );
          const team2Id = resolveTeamSource(
            match.team2Source,
            allMatches,
            groupPredictions,
            knockoutPredictions
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
  onPredictionChange,
  disabled = false,
}: KnockoutBracketProps) {
  const matchesByStage = React.useMemo(() => {
    const grouped: Record<KnockoutStage, KnockoutMatch[]> = {
      round_of_32: [],
      round_of_16: [],
      quarter_finals: [],
      semi_finals: [],
      third_place: [],
      final: [],
    };
    matches.forEach((match) => {
      grouped[match.stage].push(match);
    });
    return grouped;
  }, [matches]);

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

      {/* Tabs for stages (responsive) */}
      <Tabs defaultValue="round_of_32" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
          {STAGE_ORDER.map((stage) => {
            const config = STAGE_CONFIG[stage];
            const matches = matchesByStage[stage];
            const completedCount = matches.filter((match) => {
              const prediction = knockoutPredictions.find((p) => p.matchId === match.id);
              return prediction?.winnerId !== null && prediction?.winnerId !== undefined;
            }).length;
            const isComplete = completedCount === matches.length;

            return (
              <TabsTrigger
                key={stage}
                value={stage}
                className={cn(
                  'flex-shrink-0',
                  isComplete && 'data-[state=active]:bg-green-600 data-[state=active]:text-white'
                )}
              >
                <span className="hidden sm:inline">{config.label}</span>
                <span className="sm:hidden">{config.shortLabel}</span>
                {isComplete && <CheckCircle2 className="ml-1 h-3 w-3" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {STAGE_ORDER.map((stage) => (
          <TabsContent key={stage} value={stage}>
            <StageSection
              stage={stage}
              matches={matchesByStage[stage]}
              allMatches={matches}
              teams={teams}
              groupPredictions={groupPredictions}
              knockoutPredictions={knockoutPredictions}
              onPredictionChange={onPredictionChange}
              disabled={disabled}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Helper Text */}
      <p className="text-muted-foreground text-sm">
        Click on a team to select them as the winner of that match. Winners automatically advance to
        the next round. You must complete group predictions first to see teams in Round of 32.
      </p>
    </div>
  );
}
