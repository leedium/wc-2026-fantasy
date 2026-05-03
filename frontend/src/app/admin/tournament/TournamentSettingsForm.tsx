'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

interface TournamentInfo {
  id: string;
  slug: string;
  name: string;
  status: 'upcoming' | 'group_stage' | 'knockout' | 'completed';
  lockTime: string;
  totalEntries: number;
  championTotalGoals: number | null;
}

const STATUSES = ['upcoming', 'group_stage', 'knockout', 'completed'] as const;

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TournamentSettingsForm() {
  const queryClient = useQueryClient();
  const tournament = useQuery<TournamentInfo>({
    queryKey: ['tournament'],
    queryFn: async () => {
      const res = await fetch('/api/tournament');
      if (!res.ok) throw new Error('Failed to load tournament');
      return res.json();
    },
  });

  const [status, setStatus] = React.useState<TournamentInfo['status']>('upcoming');
  const [lockTime, setLockTime] = React.useState('');
  const [championGoals, setChampionGoals] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!tournament.data) return;
    setStatus(tournament.data.status);
    setLockTime(toDatetimeLocal(tournament.data.lockTime));
    setChampionGoals(
      tournament.data.championTotalGoals == null ? '' : String(tournament.data.championTotalGoals)
    );
  }, [tournament.data]);

  const handleSave = async () => {
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

    setSaving(true);
    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tournament.data.id,
          status,
          lockTime: new Date(lockTime).toISOString(),
          championTotalGoals,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      toast.success('Tournament updated');
      await queryClient.invalidateQueries({ queryKey: ['tournament'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <Card className="max-w-2xl">
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
                <Label htmlFor="lockTime">Lock time</Label>
                <Input
                  id="lockTime"
                  type="datetime-local"
                  value={lockTime}
                  onChange={(e) => setLockTime(e.target.value)}
                />
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
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
