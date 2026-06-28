'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TeamFlag } from '@/components/shared/TeamFlag';
import { resolveTeamSource } from '@/lib/knockoutResolver';
import type {
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  R32BracketAssignment,
  Team,
} from '@/types/tournament';

interface KnockoutResultRow {
  match_id: string;
  winner_team_id: string;
  loser_team_id: string;
  total_goals: number | null;
}

interface GroupStandingRow {
  group_id: string;
  first_team_id: string | null;
  second_team_id: string | null;
  third_team_id: string | null;
  fourth_team_id: string | null;
}

interface BracketAssignmentsResponse {
  tournamentId: string;
  assignments: Array<{ matchId: string; slot: 1 | 2; teamId: string }>;
}

interface KnockoutLockRow {
  matchId: string;
  lockedAt: string;
}

const STAGE_LABELS: Record<KnockoutMatch['stage'], string> = {
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_finals: 'Quarter-finals',
  semi_finals: 'Semi-finals',
  third_place: 'Third Place',
  final: 'Final',
};

// Sentinel for the admin-only "(none)" SelectItem (Radix forbids empty values).
const CLEAR_VALUE = '__CLEAR__';

export function KnockoutResultsEditor({
  tournamentId,
  matches,
  teams,
}: {
  tournamentId: string;
  matches: KnockoutMatch[];
  teams: Team[];
}) {
  const queryClient = useQueryClient();

  // No `initialData` here — pairing it with the global `staleTime: 60s` makes
  // React Query treat the empty seed as fresh and skip the mount fetch, so
  // saved results never appear until a manual invalidation (e.g. after a save).
  const results = useQuery<KnockoutResultRow[]>({
    queryKey: ['knockout-results', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/knockout-results?tournamentId=${tournamentId}`).catch(
        () => null
      );
      if (res && res.ok) return res.json();
      return [];
    },
  });

  const standings = useQuery<GroupStandingRow[]>({
    queryKey: ['group-standings', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/group-standings?tournamentId=${tournamentId}`).catch(
        () => null
      );
      if (res && res.ok) return res.json();
      return [];
    },
  });

  const bracket = useQuery<BracketAssignmentsResponse>({
    queryKey: ['admin-r32-bracket'],
    queryFn: async () => {
      const res = await fetch('/api/admin/r32-bracket').catch(() => null);
      if (res && res.ok) return res.json();
      return { tournamentId, assignments: [] };
    },
  });

  const locks = useQuery<KnockoutLockRow[]>({
    queryKey: ['knockout-locks', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/knockout-locks?tournamentId=${tournamentId}`).catch(
        () => null
      );
      if (res && res.ok) return res.json();
      return [];
    },
  });

  const lockedAtById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locks.data ?? []) map.set(l.matchId, l.lockedAt);
    return map;
  }, [locks.data]);

  const submittedById = React.useMemo(() => {
    const map = new Map<string, KnockoutResultRow>();
    for (const r of results.data ?? []) map.set(r.match_id, r);
    return map;
  }, [results.data]);

  // Adapt server rows to the shapes resolveTeamSource expects.
  const groupPredictions: GroupPrediction[] = React.useMemo(
    () =>
      (standings.data ?? []).map((row) => ({
        groupId: row.group_id,
        positions: {
          first: row.first_team_id,
          second: row.second_team_id,
          third: row.third_team_id,
          fourth: row.fourth_team_id,
        },
      })),
    [standings.data]
  );

  const knockoutPredictions: KnockoutMatchPrediction[] = React.useMemo(
    () =>
      (results.data ?? []).map((r) => ({
        matchId: r.match_id,
        winnerId: r.winner_team_id,
      })),
    [results.data]
  );

  const bracketAssignments: R32BracketAssignment[] = React.useMemo(
    () => bracket.data?.assignments ?? [],
    [bracket.data]
  );

  const teamById = React.useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  // For each match, resolve the two teams that will actually play.
  const resolvedPairs = React.useMemo(() => {
    const map = new Map<string, { team1Id: string | null; team2Id: string | null }>();
    for (const m of matches) {
      map.set(m.id, {
        team1Id: resolveTeamSource(
          m.team1Source,
          matches,
          groupPredictions,
          knockoutPredictions,
          bracketAssignments
        ),
        team2Id: resolveTeamSource(
          m.team2Source,
          matches,
          groupPredictions,
          knockoutPredictions,
          bracketAssignments
        ),
      });
    }
    return map;
  }, [matches, groupPredictions, knockoutPredictions, bracketAssignments]);

  const [picks, setPicks] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of matches) {
      next[m.id] = submittedById.get(m.id)?.winner_team_id ?? '';
    }
    setPicks(next);
  }, [matches, submittedById]);

  const handleClear = async (matchId: string) => {
    setPicks((prev) => ({ ...prev, [matchId]: '' }));
    if (!submittedById.has(matchId)) return;
    try {
      const res = await fetch('/api/admin/knockout-results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, matchId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to clear');
      }
      toast.success(`Match ${matchId} cleared`);
      await queryClient.invalidateQueries({ queryKey: ['knockout-results', tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard', 1] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clear');
    }
  };

  const handleSave = async (matchId: string) => {
    const winner = picks[matchId];
    const pair = resolvedPairs.get(matchId);
    if (!winner || !pair?.team1Id || !pair?.team2Id) {
      toast.error('Pick a winner first');
      return;
    }
    const loser = pair.team1Id === winner ? pair.team2Id : pair.team1Id;
    if (winner === loser) {
      toast.error('Winner and loser must differ');
      return;
    }
    setSavingId(matchId);
    try {
      const res = await fetch('/api/admin/knockout-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          matchId,
          winnerTeamId: winner,
          loserTeamId: loser,
          totalGoals: null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      toast.success(`Match ${matchId} saved`);
      await queryClient.invalidateQueries({ queryKey: ['knockout-results', tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard', 1] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  // Set (ISO string) or clear (null) the per-fixture prediction lock.
  const handleSetLock = async (matchId: string, lockedAt: string | null) => {
    try {
      const res = await fetch(`/api/admin/knockout-matches/${matchId}/lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, lockedAt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to update lock');
      }
      toast.success(lockedAt ? `Match ${matchId} lock set` : `Match ${matchId} unlocked`);
      await queryClient.invalidateQueries({ queryKey: ['knockout-locks', tournamentId] });
      // The wizard reads locks from /api/tournament; nudge that cache too.
      await queryClient.invalidateQueries({ queryKey: ['tournament'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update lock');
    }
  };

  const grouped = React.useMemo(() => {
    const map = new Map<KnockoutMatch['stage'], KnockoutMatch[]>();
    for (const m of matches) {
      const list = map.get(m.stage) ?? [];
      list.push(m);
      map.set(m.stage, list);
    }
    return map;
  }, [matches]);

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([stage, stageMatches]) => (
        <section key={stage}>
          <h3 className="mb-3 text-lg font-semibold">{STAGE_LABELS[stage]}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {stageMatches.map((m) => {
              const winner = picks[m.id] ?? '';
              const submitted = submittedById.has(m.id);
              const pair = resolvedPairs.get(m.id);
              const team1 = pair?.team1Id ? teamById.get(pair.team1Id) : undefined;
              const team2 = pair?.team2Id ? teamById.get(pair.team2Id) : undefined;
              const bothResolved = !!team1 && !!team2;

              return (
                <Card key={m.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-sm font-medium">{m.id}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          {m.team1Source} vs {m.team2Source}
                        </span>
                        {submitted ? (
                          <Badge>submitted</Badge>
                        ) : (
                          <Badge variant="outline">pending</Badge>
                        )}
                      </div>
                    </div>
                    {bothResolved ? (
                      <Select
                        value={winner}
                        onValueChange={(v) => {
                          if (v === CLEAR_VALUE) {
                            void handleClear(m.id);
                            return;
                          }
                          setPicks((prev) => ({ ...prev, [m.id]: v }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick winner" />
                        </SelectTrigger>
                        <SelectContent>
                          {winner ? (
                            <SelectItem value={CLEAR_VALUE}>
                              <span className="text-muted-foreground">(none)</span>
                            </SelectItem>
                          ) : null}
                          {[team1, team2].map((t) =>
                            t ? (
                              <SelectItem key={t.id} value={t.id}>
                                <span className="flex items-center gap-2">
                                  <TeamFlag code={t.code} />
                                  <span className="text-muted-foreground font-mono text-xs">
                                    {t.code}
                                  </span>
                                  <span>{t.name}</span>
                                </span>
                              </SelectItem>
                            ) : null
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-muted-foreground bg-muted/40 rounded-md border px-3 py-2 text-xs">
                        TBD — set the earlier results that feed this match first.
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleSave(m.id)}
                      disabled={savingId === m.id || !winner || !bothResolved}
                    >
                      {savingId === m.id ? 'Saving…' : submitted ? 'Update' : 'Save'}
                    </Button>
                    <MatchLockControl
                      matchId={m.id}
                      lockedAt={lockedAtById.get(m.id) ?? null}
                      onSetLock={handleSetLock}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// Convert an ISO string to the value a <input type="datetime-local"> expects
// (local wall-clock "YYYY-MM-DDTHH:mm", no timezone). Returns '' for null.
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Per-fixture prediction-lock control. A fixture locked at a past time freezes
// every user's pick for it; a future time schedules the lock at kickoff. This is
// independent of the match RESULT entered above — it gates predictions, not truth.
function MatchLockControl({
  matchId,
  lockedAt,
  onSetLock,
}: {
  matchId: string;
  lockedAt: string | null;
  onSetLock: (matchId: string, lockedAt: string | null) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState<string>(() => toDatetimeLocalValue(lockedAt));
  // Clock read in an effect (never during render) so the lock status label stays
  // current without tripping the purity rule.
  const [nowMs, setNowMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    setDraft(toDatetimeLocalValue(lockedAt));
  }, [lockedAt]);

  React.useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lockedMs = lockedAt ? new Date(lockedAt).getTime() : null;
  const isLockedNow = lockedMs !== null && nowMs !== null && nowMs >= lockedMs;
  const isScheduled = lockedMs !== null && nowMs !== null && nowMs < lockedMs;

  const statusLabel = isLockedNow
    ? `🔒 Locked since ${new Date(lockedAt as string).toLocaleString()}`
    : isScheduled
      ? `⏳ Locks at ${new Date(lockedAt as string).toLocaleString()}`
      : 'Predictions open';

  return (
    <div className="bg-muted/30 mt-1 space-y-2 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{statusLabel}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!draft}
          onClick={() => onSetLock(matchId, draft ? new Date(draft).toISOString() : null)}
        >
          Set lock
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => onSetLock(matchId, new Date().toISOString())}
        >
          Lock now
        </Button>
        {lockedAt ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => onSetLock(matchId, null)}
          >
            Unlock
          </Button>
        ) : null}
      </div>
    </div>
  );
}
