'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { KnockoutMatch, Team } from '@/types/tournament';

interface KnockoutResultRow {
  match_id: string;
  winner_team_id: string;
  loser_team_id: string;
  total_goals: number | null;
}

const STAGE_LABELS: Record<KnockoutMatch['stage'], string> = {
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_finals: 'Quarter-finals',
  semi_finals: 'Semi-finals',
  third_place: 'Third Place',
  final: 'Final',
};

interface MatchPicks {
  winner: string;
  loser: string;
  totalGoals: string;
}
const EMPTY: MatchPicks = { winner: '', loser: '', totalGoals: '' };

// Sentinel for the admin-only "(none)" SelectItem. Radix forbids empty-string
// item values, so we intercept this in onValueChange and fire a DELETE.
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

  const results = useQuery<KnockoutResultRow[]>({
    queryKey: ['knockout-results', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/knockout-results?tournamentId=${tournamentId}`).catch(
        () => null
      );
      if (res && res.ok) return res.json();
      return [];
    },
    initialData: [],
  });

  const submittedById = React.useMemo(() => {
    const map = new Map<string, KnockoutResultRow>();
    for (const r of results.data ?? []) map.set(r.match_id, r);
    return map;
  }, [results.data]);

  const [picks, setPicks] = React.useState<Record<string, MatchPicks>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const next: Record<string, MatchPicks> = {};
    for (const m of matches) {
      const r = submittedById.get(m.id);
      next[m.id] = r
        ? {
            winner: r.winner_team_id,
            loser: r.loser_team_id,
            totalGoals: r.total_goals != null ? String(r.total_goals) : '',
          }
        : EMPTY;
    }
    setPicks(next);
  }, [matches, submittedById]);

  const handleClear = async (matchId: string) => {
    setPicks((prev) => ({ ...prev, [matchId]: EMPTY }));
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
    const p = picks[matchId];
    if (!p || !p.winner || !p.loser) {
      toast.error('Winner and loser are required');
      return;
    }
    if (p.winner === p.loser) {
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
          winnerTeamId: p.winner,
          loserTeamId: p.loser,
          totalGoals: p.totalGoals ? Number(p.totalGoals) : null,
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
              const p = picks[m.id] ?? EMPTY;
              const submitted = submittedById.has(m.id);
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
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select
                        value={p.winner}
                        onValueChange={(v) => {
                          if (v === CLEAR_VALUE) {
                            void handleClear(m.id);
                            return;
                          }
                          setPicks((prev) => ({
                            ...prev,
                            [m.id]: { ...prev[m.id], winner: v },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Winner" />
                        </SelectTrigger>
                        <SelectContent>
                          {p.winner ? (
                            <SelectItem value={CLEAR_VALUE}>
                              <span className="text-muted-foreground">(none)</span>
                            </SelectItem>
                          ) : null}
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={p.loser}
                        onValueChange={(v) => {
                          if (v === CLEAR_VALUE) {
                            void handleClear(m.id);
                            return;
                          }
                          setPicks((prev) => ({
                            ...prev,
                            [m.id]: { ...prev[m.id], loser: v },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Loser" />
                        </SelectTrigger>
                        <SelectContent>
                          {p.loser ? (
                            <SelectItem value={CLEAR_VALUE}>
                              <span className="text-muted-foreground">(none)</span>
                            </SelectItem>
                          ) : null}
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Goals"
                        type="number"
                        value={p.totalGoals}
                        onChange={(e) =>
                          setPicks((prev) => ({
                            ...prev,
                            [m.id]: { ...prev[m.id], totalGoals: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleSave(m.id)}
                      disabled={savingId === m.id}
                    >
                      {savingId === m.id ? 'Saving…' : submitted ? 'Update' : 'Save'}
                    </Button>
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
