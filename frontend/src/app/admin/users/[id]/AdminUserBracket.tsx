'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { GroupStageForm } from '@/components/predictions/GroupStageForm';
import {
  KnockoutBracket,
  STAGE_CONFIG,
  STAGE_ORDER,
} from '@/components/predictions/KnockoutBracket';
import { TiebreakerInput } from '@/components/predictions/TiebreakerInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  Group,
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  Team,
  TournamentInfo,
} from '@/types/tournament';

type PositionKey = 'first' | 'second' | 'third' | 'fourth';

interface StoredPredictions {
  tournamentId: string;
  totalGoals: number | null;
  submittedAt: string | null;
  groups: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout: Array<{ matchId: string; winner: string | null }>;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildEmptyGroups(groups: Group[]): GroupPrediction[] {
  return groups.map((g) => ({
    groupId: g.id,
    positions: { first: null, second: null, third: null, fourth: null },
  }));
}

function buildEmptyKnockout(matches: KnockoutMatch[]): KnockoutMatchPrediction[] {
  return matches.map((m) => ({ matchId: m.id, winnerId: null }));
}

export function AdminUserBracket({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const groupsQuery = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => fetchJSON('/api/groups'),
  });
  const teamsQuery = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchJSON('/api/teams'),
  });
  const matchesQuery = useQuery<KnockoutMatch[]>({
    queryKey: ['knockout-matches'],
    queryFn: () => fetchJSON('/api/knockout-matches'),
  });
  const predQuery = useQuery<StoredPredictions>({
    queryKey: ['admin-user-predictions', userId],
    queryFn: () => fetchJSON(`/api/admin/users/${userId}/predictions`),
  });
  const tournamentQuery = useQuery<TournamentInfo>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
  });
  const paymentQuery = useQuery<{ paid: boolean; paidAt: string | null }>({
    queryKey: ['admin-user-payment', userId, tournamentQuery.data?.id],
    queryFn: () =>
      fetchJSON(
        `/api/admin/users/${userId}/payment?tournamentId=${encodeURIComponent(tournamentQuery.data!.id)}`
      ),
    enabled: !!tournamentQuery.data?.id,
  });

  const [paymentSaving, setPaymentSaving] = React.useState(false);
  const [paidAtInput, setPaidAtInput] = React.useState<string>('');

  React.useEffect(() => {
    if (paymentQuery.data?.paidAt) {
      setPaidAtInput(toLocalDatetimeInput(paymentQuery.data.paidAt));
    } else {
      setPaidAtInput('');
    }
  }, [paymentQuery.data?.paidAt]);

  const submitPayment = async (paid: boolean, paidAt: string | null) => {
    if (!tournamentQuery.data?.id) {
      toast.error('No active tournament');
      return;
    }
    setPaymentSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournamentQuery.data.id, paid, paidAt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed');
      }
      toast.success(`Marked ${paid ? 'paid' : 'unpaid'}`);
      await queryClient.invalidateQueries({
        queryKey: ['admin-user-payment', userId, tournamentQuery.data.id],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPaymentSaving(false);
    }
  };

  const [editing, setEditing] = React.useState(false);
  const [groupPreds, setGroupPreds] = React.useState<GroupPrediction[]>([]);
  const [knockoutPreds, setKnockoutPreds] = React.useState<KnockoutMatchPrediction[]>([]);
  const [totalGoals, setTotalGoals] = React.useState<number | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [knockoutStage, setKnockoutStage] = React.useState<
    (typeof STAGE_ORDER)[number]
  >('round_of_32');

  React.useEffect(() => {
    if (!groupsQuery.data || !matchesQuery.data || !predQuery.data || hydrated) return;
    const baseGroups = buildEmptyGroups(groupsQuery.data);
    const baseKnockout = buildEmptyKnockout(matchesQuery.data);
    const stored = predQuery.data;
    setGroupPreds(
      baseGroups.map((g) => {
        const m = stored.groups.find((s) => s.groupId === g.groupId);
        return m
          ? {
              groupId: g.groupId,
              positions: { first: m.first, second: m.second, third: m.third, fourth: m.fourth },
            }
          : g;
      })
    );
    setKnockoutPreds(
      baseKnockout.map((m) => {
        const s = stored.knockout.find((x) => x.matchId === m.matchId);
        return s ? { matchId: m.matchId, winnerId: s.winner } : m;
      })
    );
    setTotalGoals(stored.totalGoals);
    setHydrated(true);
  }, [groupsQuery.data, matchesQuery.data, predQuery.data, hydrated]);

  const isLoading =
    groupsQuery.isLoading || teamsQuery.isLoading || matchesQuery.isLoading || predQuery.isLoading;

  const handleGroupChange = (groupId: string, position: PositionKey, teamId: string | null) => {
    setGroupPreds((prev) =>
      prev.map((g) =>
        g.groupId === groupId
          ? { ...g, positions: { ...g.positions, [position]: teamId } }
          : g
      )
    );
  };

  const handleKnockoutChange = (matchId: string, winnerId: string | null) => {
    setKnockoutPreds((prev) =>
      prev.map((p) => (p.matchId === matchId ? { ...p, winnerId } : p))
    );
  };

  const handleSave = async () => {
    if (!predQuery.data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: predQuery.data.tournamentId,
          totalGoals,
          groups: groupPreds.map((g) => ({
            groupId: g.groupId,
            first: g.positions.first,
            second: g.positions.second,
            third: g.positions.third,
            fourth: g.positions.fourth,
          })),
          knockout: knockoutPreds.map((k) => ({ matchId: k.matchId, winner: k.winnerId })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      toast.success('Bracket saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-user-predictions', userId] });
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !hydrated || !groupsQuery.data || !teamsQuery.data || !matchesQuery.data) {
    return (
      <PageLayout>
        <h1 className="mb-2 text-3xl font-bold">Admin</h1>
        <AdminNav />
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const paid = paymentQuery.data?.paid ?? false;
            const paidAt = paymentQuery.data?.paidAt ?? null;
            const lockTime = tournamentQuery.data?.lockTime
              ? new Date(tournamentQuery.data.lockTime)
              : null;
            const isLate = paid && paidAt && lockTime ? new Date(paidAt) > lockTime : false;
            return (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {paid ? (
                  isLate ? (
                    <Badge variant="destructive">paid (after lock — not eligible)</Badge>
                  ) : (
                    <Badge>paid — eligible</Badge>
                  )
                ) : (
                  <Badge variant="outline">unpaid</Badge>
                )}
                {paidAt && (
                  <span className="text-muted-foreground">
                    at {new Date(paidAt).toLocaleString()}
                  </span>
                )}
                {lockTime && (
                  <span className="text-muted-foreground">
                    · lock: {lockTime.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs" htmlFor="paid-at">
                Paid at (optional — defaults to now)
              </label>
              <Input
                id="paid-at"
                type="datetime-local"
                value={paidAtInput}
                onChange={(e) => setPaidAtInput(e.target.value)}
                className="w-64"
                disabled={paymentSaving || !tournamentQuery.data}
              />
            </div>
            <Button
              onClick={() =>
                submitPayment(true, paidAtInput ? new Date(paidAtInput).toISOString() : null)
              }
              disabled={paymentSaving || !tournamentQuery.data}
            >
              Mark paid
            </Button>
            <Button
              variant="outline"
              onClick={() => submitPayment(false, null)}
              disabled={paymentSaving || !tournamentQuery.data || !paymentQuery.data?.paid}
            >
              Mark unpaid
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>User bracket</CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Submitted: {predQuery.data?.submittedAt ?? 'never'} · Total goals:{' '}
            {totalGoals ?? '—'}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="groups">
        <TabsList className="mb-6 grid w-full grid-cols-3">
          <TabsTrigger value="groups">Group Stage</TabsTrigger>
          <TabsTrigger value="knockout">Knockout</TabsTrigger>
          <TabsTrigger value="tiebreaker">Tiebreaker</TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <GroupStageForm
            groups={groupsQuery.data}
            predictions={groupPreds}
            onPredictionChange={handleGroupChange}
            disabled={!editing}
          />
        </TabsContent>
        <TabsContent value="knockout">
          <Tabs value={knockoutStage} onValueChange={(v) => setKnockoutStage(v as typeof knockoutStage)}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              {STAGE_ORDER.map((s) => (
                <TabsTrigger key={s} value={s} className="flex-shrink-0">
                  <span className="hidden sm:inline">{STAGE_CONFIG[s].label}</span>
                  <span className="sm:hidden">{STAGE_CONFIG[s].shortLabel}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <KnockoutBracket
              matches={matchesQuery.data}
              teams={teamsQuery.data}
              groupPredictions={groupPreds}
              knockoutPredictions={knockoutPreds}
              onPredictionChange={handleKnockoutChange}
              disabled={!editing}
              stage={knockoutStage}
            />
          </Tabs>
        </TabsContent>
        <TabsContent value="tiebreaker">
          <TiebreakerInput value={totalGoals} onChange={setTotalGoals} disabled={!editing} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
