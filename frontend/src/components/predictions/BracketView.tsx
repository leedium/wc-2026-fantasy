'use client';

import * as React from 'react';
import { Trophy } from 'lucide-react';

import { TeamFlag } from '@/components/shared/TeamFlag';
import { resolveTeamSource } from '@/lib/knockoutResolver';
import { formatSourcePair } from '@/lib/matchLabel';
import { cn } from '@/lib/utils';
import type {
  GroupPrediction,
  GroupStanding,
  KnockoutMatch,
  KnockoutMatchPrediction,
  KnockoutStage,
  R32BracketAssignment,
  Team,
} from '@/types/tournament';

interface BracketViewProps {
  matches: KnockoutMatch[];
  teams: Team[];
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
  bracketAssignments?: R32BracketAssignment[];
  groupStandings?: GroupStanding[];
}

const COLUMN_STAGES: Array<{ stage: KnockoutStage; label: string }> = [
  { stage: 'round_of_32', label: 'Round of 32' },
  { stage: 'round_of_16', label: 'Round of 16' },
  { stage: 'quarter_finals', label: 'Quarter-finals' },
  { stage: 'semi_finals', label: 'Semi-finals' },
  { stage: 'final', label: 'Final' },
];

interface MatchSlot {
  teamId: string | null;
  isWinner: boolean;
}

function teamLabel(teamId: string | null, teams: Team[]): { code: string; name: string } | null {
  if (!teamId) return null;
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;
  return { code: team.code, name: team.name };
}

function MatchNode({
  match,
  matches,
  teams,
  groupPredictions,
  knockoutPredictions,
  bracketAssignments,
  groupStandings,
}: {
  match: KnockoutMatch;
  matches: KnockoutMatch[];
  teams: Team[];
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutMatchPrediction[];
  bracketAssignments: R32BracketAssignment[];
  groupStandings: GroupStanding[];
}) {
  const team1Id = resolveTeamSource(
    match.team1Source,
    matches,
    groupPredictions,
    knockoutPredictions,
    bracketAssignments,
    groupStandings
  );
  const team2Id = resolveTeamSource(
    match.team2Source,
    matches,
    groupPredictions,
    knockoutPredictions,
    bracketAssignments,
    groupStandings
  );
  const winnerId =
    knockoutPredictions.find((p) => p.matchId === match.id)?.winnerId ?? null;

  const slots: Array<MatchSlot> = [
    { teamId: team1Id, isWinner: !!winnerId && winnerId === team1Id },
    { teamId: team2Id, isWinner: !!winnerId && winnerId === team2Id },
  ];

  return (
    <div
      className="bg-card border-border w-full rounded-md border text-xs shadow-sm"
      data-testid={`bracket-match-${match.id}`}
    >
      <div className="text-muted-foreground border-b px-2 py-1 text-[10px] font-medium tracking-wide">
        <span>{match.id}</span>
        <span className="opacity-60"> {formatSourcePair(match.team1Source, match.team2Source)}</span>
      </div>
      {slots.map((slot, idx) => {
        const label = teamLabel(slot.teamId, teams);
        return (
          <div
            key={idx}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5',
              slot.isWinner && 'bg-primary/10 font-semibold text-primary',
              idx === 0 && 'border-b'
            )}
          >
            {label ? (
              <>
                <TeamFlag code={label.code} />
                <span className="truncate">{label.name}</span>
                {slot.isWinner && (
                  <Trophy className="text-primary ml-auto h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
              </>
            ) : (
              <span className="text-muted-foreground italic">TBD</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BracketView({
  matches,
  teams,
  groupPredictions,
  knockoutPredictions,
  bracketAssignments = [],
  groupStandings = [],
}: BracketViewProps) {
  const matchesByStage = React.useMemo(() => {
    const grouped: Record<KnockoutStage, KnockoutMatch[]> = {
      round_of_32: [],
      round_of_16: [],
      quarter_finals: [],
      semi_finals: [],
      third_place: [],
      final: [],
    };
    matches.forEach((m) => grouped[m.stage].push(m));
    Object.keys(grouped).forEach((stage) => {
      grouped[stage as KnockoutStage].sort((a, b) => {
        // Ids look like "M73".."M104" (FIFA-aligned). Strip the leading
        // "M" and sort numerically; multi-digit suffixes are intentional.
        const aNum = Number(a.id.slice(1));
        const bNum = Number(b.id.slice(1));
        return aNum - bNum;
      });
    });
    return grouped;
  }, [matches]);

  const thirdPlace = matchesByStage.third_place[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      {COLUMN_STAGES.map(({ stage, label }) => {
        const stageMatches = matchesByStage[stage] ?? [];
        if (stageMatches.length === 0) return null;
        const isFinalColumn = stage === 'final';
        return (
          <div key={stage} className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              {label}
            </h3>
            <div className="space-y-2">
              {stageMatches.map((m) => (
                <MatchNode
                  key={m.id}
                  match={m}
                  matches={matches}
                  teams={teams}
                  groupPredictions={groupPredictions}
                  knockoutPredictions={knockoutPredictions}
                  bracketAssignments={bracketAssignments}
                  groupStandings={groupStandings}
                />
              ))}
            </div>
            {isFinalColumn && thirdPlace && (
              <div className="space-y-2 pt-4">
                <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Third-place play-off
                </h3>
                <MatchNode
                  match={thirdPlace}
                  matches={matches}
                  teams={teams}
                  groupPredictions={groupPredictions}
                  knockoutPredictions={knockoutPredictions}
                  bracketAssignments={bracketAssignments}
                  groupStandings={groupStandings}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
