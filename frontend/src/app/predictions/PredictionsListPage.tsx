'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock, Eye, FileEdit, Gift, Plus, Trash2 } from 'lucide-react';
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
import { useTournamentLock } from '@/hooks/useTournamentLock';
import {
  REWARDS_STATUS_QUERY_KEY,
  useRewardsStatus,
} from '@/hooks/useRewardsStatus';
import { BracketPreviewDialog } from '@/components/predictions/BracketPreviewDialog';
import { FreePickBanner } from '@/components/predictions/FreePickBanner';
import { PRICING, ROUTES } from '@/lib/constants';

interface ApiPrediction {
  id: string;
  name: string;
  totalGoals: number | null;
  submittedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
  isFreePaid: boolean;
}

interface ApiResponse {
  tournament: { id: string; lockTime: string };
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
  const { user, profile } = useAuthContext();
  const [pendingDelete, setPendingDelete] = React.useState<ApiPrediction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [redeemingId, setRedeemingId] = React.useState<string | null>(null);
  const { status: rewardsStatus } = useRewardsStatus();

  const query = useQuery<ApiResponse>({
    queryKey: ['predictions'],
    queryFn: () => fetchJSON('/api/predictions'),
  });

  // Skew-adjusted phase state — robust to client clock manipulation. The
  // server-side RPC enforces the actual write boundary; this is purely UX.
  const { isLocked, phase, advancersSet } = useTournamentLock();
  const isSuperAdmin = profile?.isSuperAdmin === true;
  // Once the knockout stage has begun (phase2 closed naturally, or admin
  // closed phase2 after posting advancers) there's nothing for a regular
  // user to edit. The Preview button still covers viewing the bracket.
  const knockoutStageLocked =
    phase === 'phase2_locked' || (phase === 'phase1_locked' && advancersSet);

  const predictions = query.data?.predictions ?? [];
  // Late-joiner block: new predictions can only be created during phase 1.
  // Super admins bypass.
  const canCreate = phase === 'phase1' || isSuperAdmin;

  const handleRedeem = async (prediction: ApiPrediction) => {
    if (redeemingId) return;
    setRedeemingId(prediction.id);
    try {
      const res = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId: prediction.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(body.error ?? 'Failed to redeem credit'));
      }
      toast.success(`Free credit applied to "${prediction.name}"`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['predictions'] }),
        queryClient.invalidateQueries({ queryKey: REWARDS_STATUS_QUERY_KEY }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to redeem credit');
    } finally {
      setRedeemingId(null);
    }
  };

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
            Create as many entries as you like. Each paid entry is ranked separately on
            the leaderboard.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            ${PRICING.entryFeeCAD} {PRICING.currency} per entry (an admin marks it paid
            once you&rsquo;ve sent payment), or earn a free pick through{' '}
            <Link href={ROUTES.referrals} className="text-primary hover:underline">
              referrals
            </Link>{' '}
            or{' '}
            <Link href={ROUTES.rewards} className="text-primary hover:underline">
              loyalty rewards
            </Link>{' '}
            and click <strong>Use free credit</strong> on any unpaid entry to apply it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href={ROUTES.results}>
              View live results
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild disabled={!canCreate} size="lg">
            <Link
              href={
                canCreate ? `${ROUTES.predictions}/${NEW_PREDICTION_SENTINEL}` : '#'
              }
              aria-disabled={!canCreate}
              title={
                isLocked && !isSuperAdmin ? 'Predictions are locked' : undefined
              }
            >
              <Plus className="mr-2 h-4 w-4" /> New prediction
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <FreePickBanner />
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    {p.submittedAt ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Submitted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <FileEdit className="h-3 w-3" /> Draft
                      </Badge>
                    )}
                    {p.isFreePaid ? (
                      <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600/90">
                        <Gift className="h-3 w-3" /> Free pick
                      </Badge>
                    ) : p.isPaid ? (
                      <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600/90">
                        <CheckCircle2 className="h-3 w-3" /> Paid
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" /> Unpaid
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-1 text-sm">
                    {p.submittedAt
                      ? `Submitted ${formatTime(p.submittedAt)}`
                      : 'Saved as draft — submit to qualify for the leaderboard'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Once the knockout stage has begun the user can't edit
                      anything. Hide the link — the Preview button (eye
                      icon) still gives them a read-only view. Super admins
                      keep the Edit button via the admin route. */}
                  {!(knockoutStageLocked && !isSuperAdmin) && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${ROUTES.predictions}/${encodeURIComponent(p.id)}`}>
                        {isLocked && !isSuperAdmin ? 'View' : 'Edit'}
                      </Link>
                    </Button>
                  )}
                  {/* Redeem a free pick (referral or loyalty) on an
                      unpaid, pre-lock, user-owned prediction. The server
                      RPC is the source of truth — we just hide the button
                      when none of the preconditions hold. */}
                  {!p.isPaid &&
                    rewardsStatus.totalAvailable > 0 &&
                    (!isLocked || isSuperAdmin) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-green-600/50 text-green-700 hover:text-green-800 dark:text-green-400"
                        onClick={() => handleRedeem(p)}
                        disabled={redeemingId === p.id}
                        title="Apply a free pick credit"
                      >
                        <Gift className="h-4 w-4" />
                        {redeemingId === p.id ? 'Applying…' : 'Use free credit'}
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewId(p.id)}
                    title="Preview bracket"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Preview</span>
                  </Button>
                  {(!isLocked || isSuperAdmin) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(p)}
                      disabled={p.isPaid}
                      title={
                        p.isPaid
                          ? 'Ask an admin to mark unpaid before deleting'
                          : 'Delete'
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
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

      <BracketPreviewDialog
        predictionId={previewId}
        apiBasePath="/api/predictions"
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
      />
    </PageLayout>
  );
}
