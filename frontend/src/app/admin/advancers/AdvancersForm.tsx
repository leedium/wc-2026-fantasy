'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AdvancersForm as RankPicker } from '@/components/predictions/AdvancersForm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { fetchJSON } from '@/lib/api/fetchJSON';
import type {
  AdvancerPrediction,
  KnockoutMatch,
  R32BracketAssignment,
  Team,
} from '@/types/tournament';

interface TournamentAdvancersResponse {
  tournamentId: string;
  advancers: Array<{ rank: number; teamId: string }>;
}

interface BracketResponse {
  tournamentId: string;
  assignments: Array<{ matchId: string; slot: 1 | 2; teamId: string }>;
}

interface GroupStandingRow {
  group_id: string;
  first_team_id: string | null;
  second_team_id: string | null;
  third_team_id: string | null;
  fourth_team_id: string | null;
}

const CLEAR_VALUE = '__CLEAR__';

type R32SourceShape =
  | { kind: 'group'; position: 1 | 2 | 3; groupId: string }
  | { kind: 'third'; groups: string[] }
  | { kind: 'unknown' };

function parseR32Source(source: string): R32SourceShape {
  const groupMatch = source.match(/^([123])([A-L])$/);
  if (groupMatch) {
    return {
      kind: 'group',
      position: Number(groupMatch[1]) as 1 | 2 | 3,
      groupId: groupMatch[2],
    };
  }
  if (/^3-[A-L]+$/.test(source)) {
    return { kind: 'third', groups: source.slice(2).split('') };
  }
  return { kind: 'unknown' };
}

function pickFromStanding(
  row: GroupStandingRow | undefined,
  position: 1 | 2 | 3
): string | null {
  if (!row) return null;
  if (position === 1) return row.first_team_id;
  if (position === 2) return row.second_team_id;
  return row.third_team_id;
}

export function AdvancersForm() {
  const queryClient = useQueryClient();
  const advancersQuery = useQuery<TournamentAdvancersResponse>({
    queryKey: ['admin-advancers'],
    queryFn: () => fetchJSON('/api/admin/third-place-advancers'),
  });
  const bracketQuery = useQuery<BracketResponse>({
    queryKey: ['admin-r32-bracket'],
    queryFn: () => fetchJSON('/api/admin/r32-bracket'),
  });
  const teamsQuery = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchJSON('/api/teams'),
  });
  const matchesQuery = useQuery<KnockoutMatch[]>({
    queryKey: ['knockout-matches'],
    queryFn: () => fetchJSON('/api/knockout-matches'),
  });

  const tournamentId = advancersQuery.data?.tournamentId ?? null;

  const standingsQuery = useQuery<GroupStandingRow[]>({
    queryKey: ['admin-group-standings', tournamentId],
    queryFn: () => fetchJSON(`/api/admin/group-standings?tournamentId=${tournamentId}`),
    enabled: !!tournamentId,
  });

  const advancers: AdvancerPrediction[] = advancersQuery.data?.advancers ?? [];
  const assignments: R32BracketAssignment[] = bracketQuery.data?.assignments ?? [];

  const teamById = React.useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teamsQuery.data ?? []) map.set(t.id, t);
    return map;
  }, [teamsQuery.data]);

  // Candidate pool: the 12 teams admin has entered as 3rd-place in
  // group_standings. Missing standings → smaller pool, but the API still
  // validates against the same set.
  const candidatePool: Team[] = React.useMemo(() => {
    const ids = new Set(
      (standingsQuery.data ?? [])
        .map((s) => s.third_team_id)
        .filter((id): id is string => !!id)
    );
    return Array.from(ids)
      .map((id) => teamById.get(id))
      .filter((t): t is Team => !!t);
  }, [standingsQuery.data, teamById]);

  // All 16 R32 matches, sorted by FIFA id (M73..M88).
  const r32Matches = React.useMemo(() => {
    return (matchesQuery.data ?? [])
      .filter((m) => m.stage === 'round_of_32')
      .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  }, [matchesQuery.data]);

  // Total number of 3rd-place R32 slots (8 per the seed). The matching
  // assignment count is what `admin_set_phase_two` gates on.
  const totalThirdSlots = React.useMemo(() => {
    let n = 0;
    for (const m of r32Matches) {
      if (m.team1Source.startsWith('3-')) n++;
      if (m.team2Source.startsWith('3-')) n++;
    }
    return n;
  }, [r32Matches]);

  // Lookup table for standings by group_id.
  const standingsByGroup = React.useMemo(() => {
    const map = new Map<string, GroupStandingRow>();
    for (const row of standingsQuery.data ?? []) map.set(row.group_id, row);
    return map;
  }, [standingsQuery.data]);

  const completedAssignments = assignments.length;

  const handleRankChange = async (rank: number, teamId: string | null) => {
    if (!tournamentId) return;
    try {
      if (teamId === null) {
        const res = await fetch('/api/admin/third-place-advancers', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId, rank }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(String(body.error ?? 'Failed'));
        }
      } else {
        const res = await fetch('/api/admin/third-place-advancers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId, rank, teamId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(String(body.error ?? 'Failed'));
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-advancers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-r32-bracket'] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const setAssignment = async (matchId: string, slot: 1 | 2, teamId: string) => {
    if (!tournamentId) return;
    try {
      const res = await fetch('/api/admin/r32-bracket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, matchId, slot, teamId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body.error ?? 'Failed'));
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-r32-bracket'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const clearAssignment = async (matchId: string, slot: 1 | 2) => {
    if (!tournamentId) return;
    try {
      const res = await fetch('/api/admin/r32-bracket', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, matchId, slot }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body.error ?? 'Failed'));
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-r32-bracket'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const loading =
    advancersQuery.isLoading || teamsQuery.isLoading || matchesQuery.isLoading;

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Top-8 advancers</h2>
          <p className="text-muted-foreground text-sm">
            Rank the 8 best 3rd-place teams in descending order. Choices are the 12 teams
            you&apos;ve entered as 3rd-place in group standings. Phase 2 controls live on the{' '}
            <span className="font-mono">Tournament</span> tab.
          </p>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <RankPicker
            variant="admin"
            candidatePool={candidatePool}
            value={advancers}
            onRankChange={handleRankChange}
          />
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">R32 bracket</h2>
          <p className="text-muted-foreground text-sm">
            Each R32 match. Group-winner / runner-up slots prefill from group standings.
            Pick the 3rd-place team for the eight 3-XXXXX slots; the dropdown is scoped to
            the third-place finishers of the groups in that slot&apos;s source.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {r32Matches.map((match) => {
            const sourceSlots: Array<{ slot: 1 | 2; source: string }> = [
              { slot: 1, source: match.team1Source },
              { slot: 2, source: match.team2Source },
            ];

            // Teams already assigned to another 3rd-place slot in this
            // tournament — used to disable duplicates so we don't hit the
            // `unique (tournament_id, team_id)` constraint.
            const usedInOtherSlots = (currentMatchId: string, currentSlot: 1 | 2) =>
              new Set(
                assignments
                  .filter(
                    (a) => !(a.matchId === currentMatchId && a.slot === currentSlot)
                  )
                  .map((a) => a.teamId)
              );

            return (
              <Card key={match.id} data-testid={`r32-match-${match.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-mono text-base">{match.id}</CardTitle>
                    <span className="text-muted-foreground font-mono text-xs">
                      {match.team1Source} vs {match.team2Source}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sourceSlots.map(({ slot, source }) => {
                    const parsed = parseR32Source(source);

                    if (parsed.kind === 'group') {
                      const teamId = pickFromStanding(
                        standingsByGroup.get(parsed.groupId),
                        parsed.position
                      );
                      const team = teamId ? teamById.get(teamId) ?? null : null;
                      return (
                        <div
                          key={slot}
                          className="bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                          data-testid={`r32-slot-${match.id}-${slot}`}
                        >
                          <span className="text-muted-foreground font-mono text-xs w-10">
                            {source}
                          </span>
                          {team ? (
                            <>
                              <TeamFlag code={team.code} />
                              <span className="truncate">{team.name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">
                              awaiting group standings
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (parsed.kind === 'third') {
                      const current = assignments.find(
                        (a) => a.matchId === match.id && a.slot === slot
                      );
                      const currentTeam = current ? teamById.get(current.teamId) ?? null : null;
                      // Options: each candidate group's third placer (if entered).
                      const options = parsed.groups
                        .map((gid) => {
                          const tid = standingsByGroup.get(gid)?.third_team_id ?? null;
                          if (!tid) return null;
                          const team = teamById.get(tid);
                          if (!team) return null;
                          return { groupId: gid, team };
                        })
                        .filter((o): o is { groupId: string; team: Team } => o !== null);
                      const used = usedInOtherSlots(match.id, slot);

                      return (
                        <div
                          key={slot}
                          className={
                            current
                              ? 'rounded-md border border-green-500/40 px-2 py-1.5'
                              : 'rounded-md border px-2 py-1.5'
                          }
                          data-testid={`r32-slot-${match.id}-${slot}`}
                        >
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-mono">{source}</span>
                            {current ? (
                              <Badge variant="default" className="bg-green-600">Set</Badge>
                            ) : (
                              <Badge variant="outline">Unset</Badge>
                            )}
                          </div>
                          <Select
                            value={current?.teamId ?? ''}
                            onValueChange={(v) => {
                              if (v === CLEAR_VALUE) {
                                void clearAssignment(match.id, slot);
                                return;
                              }
                              void setAssignment(match.id, slot, v);
                            }}
                            disabled={options.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  options.length === 0
                                    ? 'Enter group standings first'
                                    : 'Pick a 3rd-place team'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {current ? (
                                <SelectItem value={CLEAR_VALUE}>
                                  <span className="text-muted-foreground">(none)</span>
                                </SelectItem>
                              ) : null}
                              {options.map(({ groupId, team }) => {
                                const usedElsewhere = used.has(team.id);
                                return (
                                  <SelectItem
                                    key={team.id}
                                    value={team.id}
                                    disabled={usedElsewhere}
                                  >
                                    <span className="flex items-center gap-2">
                                      <TeamFlag code={team.code} />
                                      <span className="text-muted-foreground font-mono text-xs">
                                        3{groupId}
                                      </span>
                                      <span>{team.name}</span>
                                      {usedElsewhere && (
                                        <span className="text-muted-foreground ml-1 text-xs italic">
                                          (assigned elsewhere)
                                        </span>
                                      )}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {currentTeam && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              Assigned: <span className="text-foreground">{currentTeam.name}</span>
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={slot} className="text-muted-foreground text-xs">
                        Unhandled source: {source}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          {completedAssignments} / {totalThirdSlots} 3rd-place slots assigned.
        </p>
      </section>
    </div>
  );
}
