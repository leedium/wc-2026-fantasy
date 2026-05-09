'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

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
import { BUNDLE_SLOTS } from '@/lib/constants';

interface AdvancersResponse {
  tournamentId: string;
  advancers: Array<{ slotIndex: number; groupLetter: string }>;
}

interface TournamentResponse {
  id: string;
  knockoutUnlocked: boolean;
  knockoutLockTime: string | null;
  phase: 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';
}

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
  const advancersQuery = useQuery<AdvancersResponse>({
    queryKey: ['admin-advancers'],
    queryFn: () => fetchJSON('/api/admin/third-place-advancers'),
  });
  const tournamentQuery = useQuery<TournamentResponse>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
  });

  const [phaseTwoLockInput, setPhaseTwoLockInput] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setPhaseTwoLockInput(toLocalDatetimeInput(tournamentQuery.data?.knockoutLockTime ?? null));
  }, [tournamentQuery.data?.knockoutLockTime]);

  const advancers = advancersQuery.data?.advancers ?? [];
  const tournamentId = advancersQuery.data?.tournamentId ?? null;
  const completedCount = advancers.length;
  const allEight = completedCount === 8;
  const knockoutUnlocked = tournamentQuery.data?.knockoutUnlocked ?? false;

  const setSlot = async (slotIndex: number, groupLetter: string) => {
    if (!tournamentId) return;
    try {
      const res = await fetch('/api/admin/third-place-advancers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, slotIndex, groupLetter }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body.error ?? 'Failed'));
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-advancers'] });
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

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Best-3rd advancers</h2>
        <p className="text-muted-foreground text-sm">
          Pick the group whose 3rd-place team actually advanced for each of FIFA&apos;s 8
          R32 bundle slots. Phase 2 (knockout predictions) opens once all 8 are set.
        </p>
      </div>

      {advancersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {BUNDLE_SLOTS.map((slot) => {
            const pick = advancers.find((a) => a.slotIndex === slot.slotIndex);
            return (
              <Card
                key={slot.slotIndex}
                className={pick ? 'border-green-500/40' : ''}
                data-testid={`advancer-slot-${slot.slotIndex}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Best 3rd of {slot.allowedLetters.join('/')}
                    </CardTitle>
                    {pick ? (
                      <Badge variant="default" className="bg-green-600 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Set
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unset</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Feeds R32 match {slot.r32MatchId}
                  </p>
                </CardHeader>
                <CardContent>
                  <Select
                    value={pick?.groupLetter ?? ''}
                    onValueChange={(v) => setSlot(slot.slotIndex, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {slot.allowedLetters.map((letter) => (
                        <SelectItem key={letter} value={letter}>
                          Group {letter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {knockoutUnlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            Phase 2 (knockout predictions)
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Currently {knockoutUnlocked ? 'open' : 'closed'}. {completedCount}/8 advancers set.
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
              disabled={busy || !allEight || knockoutUnlocked}
              title={!allEight ? 'Set all 8 advancers first' : undefined}
            >
              Open Phase 2
            </Button>
            <Button
              variant="outline"
              onClick={() => togglePhaseTwo(false)}
              disabled={busy || !knockoutUnlocked}
            >
              Close Phase 2
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
