'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthContext } from '@/providers/AuthProvider';
import {
  NEW_PREDICTION_SENTINEL,
  clearDraftForPrediction,
} from '@/hooks/useDraftPersistence';
import { PREDICTION_CAP, ROUTES } from '@/lib/constants';

interface ApiPrediction {
  id: string;
  name: string;
  totalGoals: number | null;
  submittedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
}

interface ApiResponse {
  tournament: { id: string; lockTime: string };
  cap: number;
  predictions: ApiPrediction[];
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function PredictionsListPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [pendingDelete, setPendingDelete] = React.useState<ApiPrediction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const query = useQuery<ApiResponse>({
    queryKey: ['predictions'],
    queryFn: () => fetchJSON('/api/predictions'),
  });

  const predictions = query.data?.predictions ?? [];
  const cap = query.data?.cap ?? PREDICTION_CAP;
  const lockTime = query.data?.tournament.lockTime
    ? new Date(query.data.tournament.lockTime)
    : null;
  const isLocked = lockTime ? new Date() >= lockTime : false;
  const atCap = predictions.length >= cap;

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/predictions/${encodeURIComponent(pendingDelete.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body.error ?? 'Failed to delete'));
      }
      if (user?.id && query.data?.tournament.id) {
        clearDraftForPrediction(user.id, query.data.tournament.id, pendingDelete.id);
      }
      toast.success('Prediction deleted');
      await queryClient.invalidateQueries({ queryKey: ['predictions'] });
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageLayout>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Your Predictions</h1>
          <p className="text-muted-foreground">
            Create up to {cap} brackets. Each paid bracket is ranked separately on the leaderboard.
          </p>
        </div>
        <Button asChild disabled={atCap || isLocked} size="lg">
          <Link
            href={
              atCap || isLocked
                ? '#'
                : `${ROUTES.predictions}/${NEW_PREDICTION_SENTINEL}`
            }
            aria-disabled={atCap || isLocked}
            title={
              isLocked
                ? 'Predictions are locked'
                : atCap
                  ? `You've reached the cap of ${cap}`
                  : undefined
            }
          >
            <Plus className="mr-2 h-4 w-4" /> New prediction
          </Link>
        </Button>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : predictions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">You haven&apos;t created any predictions yet.</p>
            <Button asChild>
              <Link href={`${ROUTES.predictions}/${NEW_PREDICTION_SENTINEL}`}>
                <Plus className="mr-2 h-4 w-4" /> Create your first prediction
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {predictions.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    {p.isPaid ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Paid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" /> Unpaid
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-1 text-sm">
                    {p.submittedAt
                      ? `Last saved ${formatTime(p.submittedAt)}`
                      : 'Not yet submitted'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${ROUTES.predictions}/${encodeURIComponent(p.id)}`}>
                      {isLocked ? 'View' : 'Edit'}
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(p)}
                    disabled={isLocked || p.isPaid}
                    title={
                      p.isPaid
                        ? 'Ask an admin to mark unpaid before deleting'
                        : isLocked
                          ? 'Predictions are locked'
                          : 'Delete'
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete prediction?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name && <span>&quot;{pendingDelete.name}&quot; </span>}
              will be removed permanently. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
