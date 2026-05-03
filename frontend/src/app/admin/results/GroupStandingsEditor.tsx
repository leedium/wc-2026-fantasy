'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Group } from '@/types/tournament';

interface GroupStandingRow {
  group_id: string;
  first_team_id: string;
  second_team_id: string;
  third_team_id: string;
  fourth_team_id: string;
  submitted_at: string;
}

const POSITIONS = [
  { key: 'first', label: '1st' },
  { key: 'second', label: '2nd' },
  { key: 'third', label: '3rd' },
  { key: 'fourth', label: '4th' },
] as const;

type Slots = { first: string; second: string; third: string; fourth: string };
const EMPTY: Slots = { first: '', second: '', third: '', fourth: '' };

export function GroupStandingsEditor({
  tournamentId,
  groups,
}: {
  tournamentId: string;
  groups: Group[];
}) {
  const queryClient = useQueryClient();
  const standings = useQuery<GroupStandingRow[]>({
    queryKey: ['group-standings', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/group-standings?tournamentId=${tournamentId}`).catch(
        () => null
      );
      if (res && res.ok) return res.json();
      return [];
    },
    initialData: [],
  });

  const submittedById = React.useMemo(() => {
    const map = new Map<string, GroupStandingRow>();
    for (const r of standings.data ?? []) map.set(r.group_id, r);
    return map;
  }, [standings.data]);

  const [picks, setPicks] = React.useState<Record<string, Slots>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const next: Record<string, Slots> = {};
    for (const g of groups) {
      const row = submittedById.get(g.id);
      next[g.id] = row
        ? {
            first: row.first_team_id,
            second: row.second_team_id,
            third: row.third_team_id,
            fourth: row.fourth_team_id,
          }
        : EMPTY;
    }
    setPicks(next);
  }, [groups, submittedById]);

  const handleSave = async (groupId: string) => {
    const slots = picks[groupId];
    if (!slots || !slots.first || !slots.second || !slots.third || !slots.fourth) {
      toast.error('All four positions are required');
      return;
    }
    setSavingId(groupId);
    try {
      const res = await fetch('/api/admin/group-standings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, groupId, ...slots }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      toast.success(`Group ${groupId} saved`);
      await queryClient.invalidateQueries({ queryKey: ['group-standings', tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard', 1] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => {
        const slots = picks[g.id] ?? EMPTY;
        const submitted = submittedById.has(g.id);
        const usedIds = new Set(Object.values(slots).filter(Boolean));
        return (
          <Card key={g.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Group {g.id}</CardTitle>
              {submitted ? <Badge>submitted</Badge> : <Badge variant="outline">pending</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              {POSITIONS.map((p) => (
                <div key={p.key} className="flex items-center gap-3">
                  <span className="text-muted-foreground w-10 text-sm">{p.label}</span>
                  <Select
                    value={slots[p.key]}
                    onValueChange={(v) =>
                      setPicks((prev) => ({ ...prev, [g.id]: { ...prev[g.id], [p.key]: v } }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {g.teams.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          disabled={usedIds.has(t.id) && slots[p.key] !== t.id}
                        >
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button
                size="sm"
                onClick={() => handleSave(g.id)}
                disabled={savingId === g.id}
                className="w-full"
              >
                {savingId === g.id ? 'Saving…' : submitted ? 'Update' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
