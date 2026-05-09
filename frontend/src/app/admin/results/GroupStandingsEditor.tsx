'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GroupStageForm,
  type GroupPositionKey,
} from '@/components/predictions/GroupStageForm';
import { applyGroupPositionChange } from '@/lib/groupSwap';
import type { Group, GroupPrediction } from '@/types/tournament';

interface GroupStandingRow {
  group_id: string;
  first_team_id: string;
  second_team_id: string;
  third_team_id: string;
  fourth_team_id: string;
  submitted_at: string;
}

function emptyPredictions(groups: Group[]): GroupPrediction[] {
  return groups.map((g) => ({
    groupId: g.id,
    positions: { first: null, second: null, third: null, fourth: null },
  }));
}

function rowToPositions(row: GroupStandingRow) {
  return {
    first: row.first_team_id,
    second: row.second_team_id,
    third: row.third_team_id,
    fourth: row.fourth_team_id,
  };
}

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

  const [predictions, setPredictions] = React.useState<GroupPrediction[]>(() =>
    emptyPredictions(groups)
  );
  const [savingId, setSavingId] = React.useState<string | null>(null);

  // Hydrate predictions from server-submitted rows whenever they change.
  React.useEffect(() => {
    setPredictions(
      groups.map((g) => {
        const row = submittedById.get(g.id);
        return row
          ? { groupId: g.id, positions: rowToPositions(row) }
          : { groupId: g.id, positions: { first: null, second: null, third: null, fourth: null } };
      })
    );
  }, [groups, submittedById]);

  const handlePositionChange = (
    groupId: string,
    position: GroupPositionKey,
    teamId: string | null
  ) => {
    setPredictions((prev) => applyGroupPositionChange(prev, groupId, position, teamId));
  };

  const handleSave = async (groupId: string) => {
    const group = predictions.find((p) => p.groupId === groupId);
    const slots = group?.positions;
    if (!slots || !slots.first || !slots.second || !slots.third || !slots.fourth) {
      toast.error('All four positions are required');
      return;
    }
    setSavingId(groupId);
    try {
      const res = await fetch('/api/admin/group-standings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          groupId,
          first: slots.first,
          second: slots.second,
          third: slots.third,
          fourth: slots.fourth,
        }),
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
    <GroupStageForm
      groups={groups}
      predictions={predictions}
      onPredictionChange={handlePositionChange}
      variant="admin"
      extraPerCard={(groupId) => {
        const submitted = submittedById.has(groupId);
        const group = predictions.find((p) => p.groupId === groupId);
        const slots = group?.positions;
        const allFilled =
          !!slots && !!slots.first && !!slots.second && !!slots.third && !!slots.fourth;
        return (
          <div className="flex items-center gap-2">
            {submitted ? (
              <Badge>submitted</Badge>
            ) : (
              <Badge variant="outline">pending</Badge>
            )}
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => handleSave(groupId)}
              disabled={savingId === groupId || !allFilled}
            >
              {savingId === groupId ? 'Saving…' : submitted ? 'Update' : 'Save'}
            </Button>
          </div>
        );
      }}
    />
  );
}
