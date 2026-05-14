'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

import { AdvancersForm as RankPicker } from '@/components/predictions/AdvancersForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamFlag } from '@/components/shared/TeamFlag';
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

interface TournamentResponse {
  id: string;
  knockoutUnlocked: boolean;
  knockoutLockTime: string | null;
  phase: 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';
}

interface GroupStandingRow {
  group_id: string;
  third_team_id: string | null;
}

const CLEAR_VALUE = '__CLEAR__';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const tournamentQuery = useQuery<TournamentResponse>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
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

  const [phaseTwoLockInput, setPhaseTwoLockInput] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setPhaseTwoLockInput(toLocalDatetimeInput(tournamentQuery.data?.knockoutLockTime ?? null));
  }, [tournamentQuery.data?.knockoutLockTime]);

  const advancers: AdvancerPrediction[] = advancersQuery.data?.advancers ?? [];
  const assignments: R32BracketAssignment[] = bracketQuery.data?.assignments ?? [];
  const phase = tournamentQuery.data?.phase ?? 'phase1';

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

  // The 3rd-place R32 slots, discovered by scanning seed sources. Source of
  // truth for the count is the same as in admin_set_phase_two.
  const thirdPlaceSlots = React.useMemo(() => {
    const out: Array<{ matchId: string; slot: 1 | 2; sourceLabel: string }> = [];
    for (const m of matchesQuery.data ?? []) {
      if (m.stage !== 'round_of_32') continue;
      if (m.team1Source.startsWith('3-')) {
        out.push({ matchId: m.id, slot: 1, sourceLabel: m.team1Source });
      }
      if (m.team2Source.startsWith('3-')) {
        out.push({ matchId: m.id, slot: 2, sourceLabel: m.team2Source });
      }
    }
    return out;
  }, [matchesQuery.data]);

  const completedAdvancers = advancers.length;
  const completedAssignments = assignments.length;
  const allAdvancersSet = completedAdvancers === 8;
  const allAssignmentsSet = completedAssignments === thirdPlaceSlots.length;
  const canOpenPhaseTwo = allAdvancersSet && allAssignmentsSet;

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

  const togglePhaseTwo = async (unlock: boolean) => {
    if (!tournamentId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournamentId,
          knockoutUnlocked: unlock,
          knockoutLockTime: unlock && phaseTwoLockInput
            ? new Date(phaseTwoLockInput).toISOString()
            : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body.error ?? 'Failed'));
      }
      toast.success(unlock ? 'Phase 2 opened' : 'Phase 2 closed');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-advancers'] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const loading =
    advancersQuery.isLoading ||
    tournamentQuery.isLoading ||
    teamsQuery.isLoading ||
    matchesQuery.isLoading;

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Top-8 advancers</h2>
          <p className="text-muted-foreground text-sm">
            Rank the 8 best 3rd-place teams in descending order. Choices are the 12 teams
            you&apos;ve entered as 3rd-place in group standings.
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
          <h2 className="text-xl font-semibold">FIFA R32 bracket assignment</h2>
          <p className="text-muted-foreground text-sm">
            For each R32 3rd-place slot, pick which of the 8 advancers FIFA placed there.
            Available once all 8 advancers are set.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {thirdPlaceSlots.map(({ matchId, slot, sourceLabel }) => {
            const current = assignments.find((a) => a.matchId === matchId && a.slot === slot);
            const currentTeam = current ? teamById.get(current.teamId) : null;
            // Teams already assigned to a different slot — disable them so
            // the admin can't accidentally double-assign and hit the
            // `unique (tournament_id, team_id)` constraint error.
            const assignedElsewhere = new Set(
              assignments
                .filter((a) => !(a.matchId === matchId && a.slot === slot))
                .map((a) => a.teamId)
            );

            return (
              <Card
                key={`${matchId}-${slot}`}
                className={current ? 'border-green-500/40' : ''}
                data-testid={`r32-slot-${matchId}-${slot}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-mono">{matchId} · slot {slot}</CardTitle>
                    {current ? (
                      <Badge variant="default" className="bg-green-600">Set</Badge>
                    ) : (
                      <Badge variant="outline">Unset</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Legacy source: {sourceLabel}
                  </p>
                </CardHeader>
                <CardContent>
                  <Select
                    value={current?.teamId ?? ''}
                    onValueChange={(v) => {
                      if (v === CLEAR_VALUE) {
                        void clearAssignment(matchId, slot);
                        return;
                      }
                      void setAssignment(matchId, slot, v);
                    }}
                    disabled={!allAdvancersSet}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          allAdvancersSet
                            ? 'Pick an advancer'
                            : 'Set all 8 advancers first'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {current ? (
                        <SelectItem value={CLEAR_VALUE}>
                          <span className="text-muted-foreground">(none)</span>
                        </SelectItem>
                      ) : null}
                      {advancers.map((a) => {
                        const team = teamById.get(a.teamId);
                        if (!team) return null;
                        const usedElsewhere = assignedElsewhere.has(team.id);
                        return (
                          <SelectItem
                            key={a.rank}
                            value={team.id}
                            disabled={usedElsewhere}
                          >
                            <span className="flex items-center gap-2">
                              <TeamFlag code={team.code} />
                              <span className="text-muted-foreground font-mono text-xs">
                                #{a.rank}
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
                    <p className="text-muted-foreground mt-2 text-xs">
                      Currently assigned: <span className="text-foreground">{currentTeam.name}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          {completedAssignments} / {thirdPlaceSlots.length} bracket slots assigned.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {phase === 'phase2_open' ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            Phase 2 (knockout predictions)
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Currently{' '}
            {phase === 'phase2_open'
              ? 'open'
              : phase === 'phase2_locked'
                ? 'closed (lock time has passed — set a new lock time to reopen)'
                : 'closed'}
            . {completedAdvancers}/8 advancers set ·{' '}
            {completedAssignments}/{thirdPlaceSlots.length} bracket slots assigned.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="phase2-lock">Knockout lock time (when phase 2 closes)</Label>
            <Input
              id="phase2-lock"
              type="datetime-local"
              value={phaseTwoLockInput}
              onChange={(e) => setPhaseTwoLockInput(e.target.value)}
              className="max-w-sm"
              disabled={busy}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => togglePhaseTwo(true)}
              disabled={busy || !canOpenPhaseTwo || phase === 'phase2_open'}
              title={
                !allAdvancersSet
                  ? 'Set all 8 advancers first'
                  : !allAssignmentsSet
                    ? 'Assign every R32 3rd-place slot first'
                    : phase === 'phase2_locked'
                      ? 'Phase 2 lock time has passed — set a new lock time above and click to reopen'
                      : undefined
              }
            >
              {phase === 'phase2_locked' ? 'Reopen Phase 2' : 'Open Phase 2'}
            </Button>
            <Button
              variant="outline"
              onClick={() => togglePhaseTwo(false)}
              disabled={busy || phase !== 'phase2_open'}
            >
              Close Phase 2
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
