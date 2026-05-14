'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { KnockoutMatch } from '@/types/tournament';

interface TournamentInfo {
  id: string;
  slug: string;
  name: string;
  status: 'upcoming' | 'group_stage' | 'knockout' | 'completed';
  lockTime: string;
  knockoutLockTime: string | null;
  knockoutUnlocked: boolean;
  phase: 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';
  totalEntries: number;
  championTotalGoals: number | null;
}

interface AdvancersResponse {
  tournamentId: string;
  advancers: Array<{ rank: number; teamId: string }>;
}

interface BracketResponse {
  tournamentId: string;
  assignments: Array<{ matchId: string; slot: 1 | 2; teamId: string }>;
}

const STATUSES = ['upcoming', 'group_stage', 'knockout', 'completed'] as const;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TournamentSettingsForm() {
  const queryClient = useQueryClient();
  const tournament = useQuery<TournamentInfo>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
  });

  // Phase 2 toggle pre-flight checks: all 8 advancers + all R32 3rd-place
  // bracket slots must be assigned. These queries mirror the ones the
  // /admin/advancers page used to own when it hosted the Phase 2 controls.
  const advancersQuery = useQuery<AdvancersResponse>({
    queryKey: ['admin-advancers'],
    queryFn: () => fetchJSON('/api/admin/third-place-advancers'),
  });
  const bracketQuery = useQuery<BracketResponse>({
    queryKey: ['admin-r32-bracket'],
    queryFn: () => fetchJSON('/api/admin/r32-bracket'),
  });
  const matchesQuery = useQuery<KnockoutMatch[]>({
    queryKey: ['knockout-matches'],
    queryFn: () => fetchJSON('/api/knockout-matches'),
  });

  const [status, setStatus] = React.useState<TournamentInfo['status']>('upcoming');
  const [lockTime, setLockTime] = React.useState('');
  const [phaseTwoLockInput, setPhaseTwoLockInput] = React.useState('');
  const [championGoals, setChampionGoals] = React.useState('');
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [savingPhase1, setSavingPhase1] = React.useState(false);
  const [busyPhase2, setBusyPhase2] = React.useState(false);

  React.useEffect(() => {
    if (!tournament.data) return;
    setStatus(tournament.data.status);
    setLockTime(toDatetimeLocal(tournament.data.lockTime));
    setPhaseTwoLockInput(toDatetimeLocal(tournament.data.knockoutLockTime));
    setChampionGoals(
      tournament.data.championTotalGoals == null ? '' : String(tournament.data.championTotalGoals)
    );
  }, [tournament.data]);

  const handleSaveSettings = async () => {
    if (!tournament.data) return;

    let championTotalGoals: number | null | undefined;
    if (championGoals.trim() === '') {
      championTotalGoals = null;
    } else {
      const parsed = Number(championGoals);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 50) {
        toast.error("Champion's total goals must be an integer 0–50");
        return;
      }
      championTotalGoals = parsed;
    }

    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournament.data.id,
          status,
          championTotalGoals,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      toast.success('Tournament settings updated');
      await queryClient.invalidateQueries({ queryKey: ['tournament'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePhase1Lock = async () => {
    if (!tournament.data) return;
    if (!lockTime) {
      toast.error('Pick a Phase 1 lock time first');
      return;
    }
    setSavingPhase1(true);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournament.data.id,
          lockTime: new Date(lockTime).toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      toast.success('Phase 1 lock time updated');
      await queryClient.invalidateQueries({ queryKey: ['tournament'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingPhase1(false);
    }
  };

  // Phase 2 derived state.
  const advancersCount = advancersQuery.data?.advancers.length ?? 0;
  const assignmentsCount = bracketQuery.data?.assignments.length ?? 0;
  const thirdPlaceSlotCount = React.useMemo(() => {
    let n = 0;
    for (const m of matchesQuery.data ?? []) {
      if (m.stage !== 'round_of_32') continue;
      if (m.team1Source.startsWith('3-')) n++;
      if (m.team2Source.startsWith('3-')) n++;
    }
    return n;
  }, [matchesQuery.data]);

  const allAdvancersSet = advancersCount === 8;
  const allAssignmentsSet =
    thirdPlaceSlotCount > 0 && assignmentsCount === thirdPlaceSlotCount;
  const canOpenPhaseTwo = allAdvancersSet && allAssignmentsSet;
  const phase = tournament.data?.phase ?? 'phase1';

  const togglePhaseTwo = async (unlock: boolean) => {
    if (!tournament.data) return;
    setBusyPhase2(true);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournament.data.id,
          knockoutUnlocked: unlock,
          knockoutLockTime:
            unlock && phaseTwoLockInput ? new Date(phaseTwoLockInput).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed');
      }
      toast.success(unlock ? 'Phase 2 opened' : 'Phase 2 closed');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-advancers'] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyPhase2(false);
    }
  };

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tournament settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tournament.isLoading || !tournament.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <p className="text-sm">{tournament.data.name}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as TournamentInfo['status'])}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="championGoals">Champion&apos;s total goals (tiebreaker)</Label>
                  <Input
                    id="championGoals"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    placeholder="Leave blank until tournament ends"
                    value={championGoals}
                    onChange={(e) => setChampionGoals(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Total goals scored by the World Cup champion across all 8 of their tournament
                    matches (regulation and extra time only — penalty-shootout goals don&apos;t
                    count). Used as the tiebreaker on the leaderboard. Leave blank until the
                    tournament is complete.
                  </p>
                </div>
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Saving…' : 'Save changes'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {phase === 'phase1' ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              Phase 1 (group + advancer predictions)
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Currently{' '}
              {phase === 'phase1'
                ? 'open — users can edit groups + advancers'
                : 'closed — group + advancer picks are frozen'}
              .
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="lockTime">Phase 1 lock time</Label>
              <Input
                id="lockTime"
                type="datetime-local"
                value={lockTime}
                onChange={(e) => setLockTime(e.target.value)}
                className="max-w-sm"
                disabled={savingPhase1}
              />
              <p className="text-muted-foreground text-xs">
                When group + advancer picks freeze. Tournament-wide cutoff for new
                predictions.
              </p>
            </div>
            <Button onClick={handleSavePhase1Lock} disabled={savingPhase1}>
              {savingPhase1 ? 'Saving…' : 'Save Phase 1 lock time'}
            </Button>
          </CardContent>
        </Card>

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
              . {advancersCount}/8 advancers set ·{' '}
              {assignmentsCount}/{thirdPlaceSlotCount || 8} bracket slots assigned.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="phase2-lock">Phase 2 lock time</Label>
              <Input
                id="phase2-lock"
                type="datetime-local"
                value={phaseTwoLockInput}
                onChange={(e) => setPhaseTwoLockInput(e.target.value)}
                className="max-w-sm"
                disabled={busyPhase2}
              />
              <p className="text-muted-foreground text-xs">
                When knockout predictions freeze. Set + click Open Phase 2 to start the knockout
                window. Advancers + R32 bracket assignments must be filled on the{' '}
                <span className="font-mono">/admin/advancers</span> tab first.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => togglePhaseTwo(true)}
                disabled={busyPhase2 || !canOpenPhaseTwo || phase === 'phase2_open'}
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
                disabled={busyPhase2 || phase !== 'phase2_open'}
              >
                Close Phase 2
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
