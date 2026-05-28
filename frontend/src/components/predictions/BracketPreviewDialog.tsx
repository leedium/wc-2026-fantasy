'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, User as UserIcon } from 'lucide-react';

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
import { TeamFlag } from '@/components/shared/TeamFlag';
import { fetchJSON } from '@/lib/api/fetchJSON';
import type {
  Group,
  KnockoutMatch,
  R32BracketAssignment,
  Team,
} from '@/types/tournament';

interface PredictionDetail {
  id: string;
  name: string;
  username: string | null;
  totalGoals: number | null;
  championTeamId: string | null;
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

  const bracketQuery = useQuery<{ assignments: R32BracketAssignment[] }>({
    queryKey: ['r32-bracket'],
    enabled: open,
    queryFn: () => fetchJSON('/api/r32-bracket'),
  });
  const bracketAssignments = bracketQuery.data?.assignments ?? [];

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
                {predictionQuery.data.isPaid ? (
                  <Badge
                    variant="default"
                    className="bg-green-600 hover:bg-green-600/90"
                  >
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="destructive">Unpaid</Badge>
                )}
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
          <>
            <PredictionMetaBar
              username={predictionQuery.data!.username}
              championTeamId={predictionQuery.data!.championTeamId}
              totalGoals={predictionQuery.data!.totalGoals}
              teams={teamsQuery.data!}
            />
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
              bracketAssignments={bracketAssignments}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PredictionMetaBarProps {
  username: string | null;
  championTeamId: string | null;
  totalGoals: number | null;
  teams: Team[];
}

function PredictionMetaBar({
  username,
  championTeamId,
  totalGoals,
  teams,
}: PredictionMetaBarProps) {
  const championTeam = championTeamId
    ? (teams.find((t) => t.id === championTeamId) ?? null)
    : null;

  return (
    <dl className="bg-muted/40 grid gap-3 rounded-md border px-4 py-3 text-sm sm:grid-cols-3">
      <div className="flex items-start gap-2">
        <UserIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <dt className="text-muted-foreground text-xs">User</dt>
          <dd className="font-medium">{username ? `@${username}` : '—'}</dd>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Trophy className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <dt className="text-muted-foreground text-xs">Gut Feeling Champion</dt>
          <dd className="font-medium">
            {championTeam ? (
              <span className="inline-flex items-center gap-1.5">
                <TeamFlag code={championTeam.code} className="h-4 w-6" />
                {championTeam.name}
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="text-muted-foreground mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-base leading-none"
        >
          ⚽
        </span>
        <div>
          <dt className="text-muted-foreground text-xs">Champion total goals</dt>
          <dd className="font-medium">{totalGoals != null ? totalGoals : '—'}</dd>
        </div>
      </div>
    </dl>
  );
}
