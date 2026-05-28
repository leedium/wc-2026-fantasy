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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthContext } from '@/providers/AuthProvider';
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

interface GroupStandingRow {
  group_id: string;
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
  const { profile } = useAuthContext();
  const isSuperAdmin = profile?.isSuperAdmin ?? false;
  const tournament = useQuery<TournamentInfo>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
  });

  // Phase 2 toggle pre-flight checks: all 12 group standings + all R32
  // 3rd-place bracket slots must be assigned (advancers are no longer a
  // Phase 2 gate — they're scoring inputs that can be filled any time).
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
  const tournamentIdForStandings = tournament.data?.id ?? null;
  const standingsQuery = useQuery<GroupStandingRow[]>({
    queryKey: ['admin-group-standings', tournamentIdForStandings],
    queryFn: () =>
      fetchJSON(`/api/admin/group-standings?tournamentId=${tournamentIdForStandings}`),
    enabled: !!tournamentIdForStandings,
  });

  const [status, setStatus] = React.useState<TournamentInfo['status']>('upcoming');
  const [lockTime, setLockTime] = React.useState('');
  const [phaseTwoLockInput, setPhaseTwoLockInput] = React.useState('');
  const [championGoals, setChampionGoals] = React.useState('');
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [savingPhase1, setSavingPhase1] = React.useState(false);
  const [busyPhase2, setBusyPhase2] = React.useState(false);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);
  const [resetConfirm, setResetConfirm] = React.useState('');
  const [resetting, setResetting] = React.useState(false);

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
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 200) {
        toast.error("Champion's total goals must be an integer 0–200");
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
      ]);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingPhase1(false);
    }
  };

  // Phase 2 derived state.
  const advancersCount = advancersQuery.data?.advancers.length ?? 0;
  const assignmentsCount = bracketQuery.data?.assignments.length ?? 0;
  const standingsCount = standingsQuery.data?.length ?? 0;
  const thirdPlaceSlotCount = React.useMemo(() => {
    let n = 0;
    for (const m of matchesQuery.data ?? []) {
      if (m.stage !== 'round_of_32') continue;
      if (m.team1Source.startsWith('3-')) n++;
      if (m.team2Source.startsWith('3-')) n++;
    }
    return n;
  }, [matchesQuery.data]);

  const allStandingsSet = standingsCount === 12;
  const allAssignmentsSet =
    thirdPlaceSlotCount > 0 && assignmentsCount === thirdPlaceSlotCount;
  const canOpenPhaseTwo = allStandingsSet && allAssignmentsSet;
  const phase = tournament.data?.phase ?? 'phase1';

  const phaseTwoLockIso = React.useMemo(() => {
    if (!phaseTwoLockInput.trim()) return null;
    const ms = new Date(phaseTwoLockInput).getTime();
    if (Number.isNaN(ms)) return null;
    return new Date(ms).toISOString();
  }, [phaseTwoLockInput]);

  const phaseTwoLockInPast = React.useMemo(() => {
    if (!phaseTwoLockIso) return false;
    return new Date(phaseTwoLockIso).getTime() <= Date.now();
  }, [phaseTwoLockIso]);

  const togglePhaseTwo = async (unlock: boolean) => {
    if (!tournament.data) return;
    if (unlock) {
      if (!phaseTwoLockIso) {
        toast.error('Pick a Phase 2 lock time first');
        return;
      }
      if (phaseTwoLockInPast) {
        toast.error('Phase 2 lock time must be in the future');
        return;
      }
    }
    setBusyPhase2(true);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournament.data.id,
          knockoutUnlocked: unlock,
          knockoutLockTime: unlock ? phaseTwoLockIso : null,
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
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyPhase2(false);
    }
  };

  const handleReset = async () => {
    if (!tournament.data) return;
    if (resetConfirm !== 'RESET') return;
    setResetting(true);
    try {
      const res = await fetch('/api/admin/tournament/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tournament.data.id, confirm: 'RESET' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to reset tournament');
      }
      toast.success('Tournament reset');
      setResetDialogOpen(false);
      setResetConfirm('');
      // Reset wipes predictions, payments, standings, results, advancers,
      // bracket, and rewards — invalidate the whole cluster including
      // admin-users (paid/prediction counts), admin-stats (dashboard),
      // predictions (user prediction lists), and leaderboard (any cached
      // viewer/page variants).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-advancers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-r32-bracket'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['predictions'] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset tournament');
    } finally {
      setResetting(false);
    }
  };

  // While Phase 2 is open, allow extending/shortening the lock time without
  // having to close-and-reopen. Goes through the same admin_set_phase_two
  // RPC with knockoutUnlocked=true.
  const handleSavePhaseTwoLockTime = async () => {
    if (!tournament.data) return;
    if (!phaseTwoLockIso) {
      toast.error('Pick a Phase 2 lock time first');
      return;
    }
    if (phaseTwoLockInPast) {
      toast.error('Phase 2 lock time must be in the future');
      return;
    }
    setBusyPhase2(true);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournament.data.id,
          knockoutUnlocked: true,
          knockoutLockTime: phaseTwoLockIso,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed');
      }
      toast.success('Phase 2 lock time updated');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
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
                    max={200}
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
              . {standingsCount}/12 group standings ·{' '}
              {assignmentsCount}/{thirdPlaceSlotCount || 8} bracket slots assigned ·{' '}
              {advancersCount}/8 advancers (scoring only).
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
                window. Group standings + R32 bracket assignments must be filled on the{' '}
                <span className="font-mono">/admin/results</span> and{' '}
                <span className="font-mono">/admin/advancers</span> tabs first.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => togglePhaseTwo(true)}
                disabled={
                  busyPhase2 ||
                  !canOpenPhaseTwo ||
                  phase === 'phase2_open' ||
                  !phaseTwoLockIso ||
                  phaseTwoLockInPast
                }
                title={
                  !allStandingsSet
                    ? 'Enter all 12 group standings first'
                    : !allAssignmentsSet
                      ? 'Assign every R32 3rd-place slot first'
                      : !phaseTwoLockIso
                        ? 'Pick a Phase 2 lock time first'
                        : phaseTwoLockInPast
                          ? 'Phase 2 lock time must be in the future'
                          : phase === 'phase2_locked'
                            ? 'Phase 2 lock time has passed — set a new lock time above and click to reopen'
                            : undefined
                }
              >
                {phase === 'phase2_locked' ? 'Reopen Phase 2' : 'Open Phase 2'}
              </Button>
              {phase === 'phase2_open' && (
                <Button
                  variant="secondary"
                  onClick={handleSavePhaseTwoLockTime}
                  disabled={
                    busyPhase2 ||
                    !phaseTwoLockIso ||
                    phaseTwoLockInPast ||
                    phaseTwoLockIso === tournament.data?.knockoutLockTime
                  }
                  title={
                    !phaseTwoLockIso
                      ? 'Pick a Phase 2 lock time first'
                      : phaseTwoLockInPast
                        ? 'Phase 2 lock time must be in the future'
                        : phaseTwoLockIso === tournament.data?.knockoutLockTime
                          ? 'Lock time is unchanged'
                          : undefined
                  }
                >
                  Save Phase 2 lock time
                </Button>
              )}
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

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <p className="text-muted-foreground text-sm">
              Super-admin only. Wipes every user&apos;s predictions, payments, and reward
              redemptions for this tournament; clears admin-entered group standings,
              knockout results, and the R32 bracket; resets Phase 1 / Phase 2 lock times
              and tournament status. User accounts, profiles, and referral codes are
              preserved.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setResetDialogOpen(true)}
              disabled={!isSuperAdmin || !tournament.data}
              title={!isSuperAdmin ? 'Super admin only' : undefined}
            >
              Reset tournament
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          setResetDialogOpen(open);
          if (!open) setResetConfirm('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset tournament</DialogTitle>
            <DialogDescription>
              This cannot be undone. The following will be deleted for{' '}
              <span className="font-mono">{tournament.data?.name}</span>:
            </DialogDescription>
          </DialogHeader>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>All user predictions, group picks, knockout picks, advancer picks</li>
            <li>All payment records (cash + free picks from referrals / loyalty)</li>
            <li>All reward redemptions for this tournament</li>
            <li>Admin-entered group standings, knockout results, R32 bracket</li>
            <li>
              Phase 1 lock time, Phase 2 lock time, status, and champion total goals are
              reset
            </li>
          </ul>
          <div className="space-y-1">
            <Label htmlFor="reset-confirm">
              Type <span className="font-mono font-semibold">RESET</span> to confirm
            </Label>
            <Input
              id="reset-confirm"
              autoComplete="off"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              disabled={resetting}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting || resetConfirm !== 'RESET'}
            >
              {resetting ? 'Resetting…' : 'Reset tournament'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
