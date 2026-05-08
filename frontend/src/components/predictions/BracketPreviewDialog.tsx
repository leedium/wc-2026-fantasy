'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { BracketView } from '@/components/predictions/BracketView';
import type { Group, KnockoutMatch, Team } from '@/types/tournament';

interface PredictionDetail {
  id: string;
  name: string;
  totalGoals: number | null;
  submittedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
  groups: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  knockout: Array<{ matchId: string; winner: string | null }>;
}

export interface BracketPreviewDialogProps {
  predictionId: string | null;
  /** e.g. '/api/predictions' or `/api/admin/users/${userId}/predictions`. */
  apiBasePath: string;
  onOpenChange: (open: boolean) => void;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

export function BracketPreviewDialog({
  predictionId,
  apiBasePath,
  onOpenChange,
}: BracketPreviewDialogProps) {
  const open = predictionId !== null;

  const predictionQuery = useQuery<PredictionDetail>({
    queryKey: ['prediction', apiBasePath, predictionId],
    enabled: open && !!predictionId,
    queryFn: () => fetchJSON(`${apiBasePath}/${encodeURIComponent(predictionId!)}`),
  });

  const matchesQuery = useQuery<KnockoutMatch[]>({
    queryKey: ['knockout-matches'],
    enabled: open,
    queryFn: () => fetchJSON('/api/knockout-matches'),
  });

  const teamsQuery = useQuery<Team[]>({
    queryKey: ['teams'],
    enabled: open,
    queryFn: () => fetchJSON('/api/teams'),
  });

  const groupsQuery = useQuery<Group[]>({
    queryKey: ['groups'],
    enabled: open,
    queryFn: () => fetchJSON('/api/groups'),
  });

  const ready =
    predictionQuery.data && matchesQuery.data && teamsQuery.data && groupsQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {predictionQuery.data?.name ?? 'Bracket'}
            {predictionQuery.data && (
              <>
                <Badge variant={predictionQuery.data.submittedAt ? 'secondary' : 'outline'}>
                  {predictionQuery.data.submittedAt ? 'Submitted' : 'Draft'}
                </Badge>
                <Badge variant={predictionQuery.data.isPaid ? 'default' : 'outline'}>
                  {predictionQuery.data.isPaid ? 'Paid' : 'Unpaid'}
                </Badge>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Read-only preview of the bracket as predicted. Empty slots show as TBD.
          </DialogDescription>
        </DialogHeader>

        {predictionQuery.isError && (
          <p className="text-destructive text-sm" role="alert">
            Couldn&apos;t load this prediction.
          </p>
        )}

        {!ready && !predictionQuery.isError && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {ready && (
          <BracketView
            matches={matchesQuery.data!}
            teams={teamsQuery.data!}
            groupPredictions={(predictionQuery.data!.groups ?? []).map((g) => ({
              groupId: g.groupId,
              positions: {
                first: g.first,
                second: g.second,
                third: g.third,
                fourth: g.fourth,
              },
            }))}
            knockoutPredictions={(predictionQuery.data!.knockout ?? []).map((k) => ({
              matchId: k.matchId,
              winnerId: k.winner,
            }))}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
