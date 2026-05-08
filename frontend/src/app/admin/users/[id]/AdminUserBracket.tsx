'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BracketPreviewDialog } from '@/components/predictions/BracketPreviewDialog';

interface AdminPrediction {
  id: string;
  name: string;
  totalGoals: number | null;
  submittedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
  markedBy: string | null;
}

interface AdminPredictionsResponse {
  tournament: { id: string; lockTime: string };
  predictions: AdminPrediction[];
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

function PaymentRow({
  prediction,
  lockTime,
  onChanged,
}: {
  prediction: AdminPrediction;
  lockTime: Date | null;
  onChanged: () => void;
}) {
  const [paidAtInput, setPaidAtInput] = React.useState(
    prediction.paidAt ? toLocalDatetimeInput(prediction.paidAt) : ''
  );
  const [busy, setBusy] = React.useState(false);

  const submit = async (paid: boolean, paidAt: string | null) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/predictions/${encodeURIComponent(prediction.id)}/payment`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paid, paidAt }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body.error ?? 'Failed'));
      }
      toast.success(`Marked ${paid ? 'paid' : 'unpaid'}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const isLate =
    prediction.isPaid &&
    prediction.paidAt &&
    lockTime &&
    new Date(prediction.paidAt) > lockTime;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        {prediction.isPaid ? (
          isLate ? (
            <Badge variant="destructive">paid (after lock — not eligible)</Badge>
          ) : (
            <Badge>paid — eligible</Badge>
          )
        ) : (
          <Badge variant="outline">unpaid</Badge>
        )}
        {prediction.paidAt && (
          <span className="text-muted-foreground text-xs">
            at {new Date(prediction.paidAt).toLocaleString()}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs" htmlFor={`paid-at-${prediction.id}`}>
            Paid at (optional)
          </label>
          <Input
            id={`paid-at-${prediction.id}`}
            type="datetime-local"
            value={paidAtInput}
            onChange={(e) => setPaidAtInput(e.target.value)}
            className="w-56"
            disabled={busy}
          />
        </div>
        <Button
          size="sm"
          onClick={() => submit(true, paidAtInput ? new Date(paidAtInput).toISOString() : null)}
          disabled={busy}
        >
          Mark paid
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => submit(false, null)}
          disabled={busy || !prediction.isPaid}
        >
          Mark unpaid
        </Button>
      </div>
    </div>
  );
}

export function AdminUserBracket({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = React.useState<AdminPrediction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const query = useQuery<AdminPredictionsResponse>({
    queryKey: ['admin-user-predictions', userId],
    queryFn: () => fetchJSON(`/api/admin/users/${userId}/predictions`),
  });

  const lockTime = query.data?.tournament.lockTime
    ? new Date(query.data.tournament.lockTime)
    : null;
  const predictions = query.data?.predictions ?? [];

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['admin-user-predictions', userId] }),
    [queryClient, userId]
  );

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/users/${userId}/predictions/${encodeURIComponent(pendingDelete.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body.error ?? 'Failed'));
      }
      toast.success('Prediction deleted');
      await refresh();
      setPendingDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIsDeleting(false);
    }
  };

  if (query.isLoading) {
    return (
      <PageLayout>
        <h1 className="mb-2 text-3xl font-bold">Admin</h1>
        <AdminNav />
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">User predictions</h2>
        <Button asChild>
          <Link href={`/admin/users/${userId}/predictions/new`}>
            <Plus className="mr-2 h-4 w-4" /> New prediction
          </Link>
        </Button>
      </div>

      {predictions.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            This user has not created any predictions yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {predictions.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {p.name}
                  {p.submittedAt ? (
                    <span className="text-muted-foreground text-xs font-normal">
                      submitted {new Date(p.submittedAt).toLocaleString()}
                    </span>
                  ) : null}
                </CardTitle>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/users/${userId}/predictions/${encodeURIComponent(p.id)}`}>
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewId(p.id)}
                    title="Preview bracket"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Preview</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(p)}
                    disabled={p.isPaid}
                    title={p.isPaid ? 'Mark unpaid before deleting' : 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <PaymentRow prediction={p} lockTime={lockTime} onChanged={refresh} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open: boolean) => !open && setPendingDelete(null)}
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
        apiBasePath={`/api/admin/users/${userId}/predictions`}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
      />
    </PageLayout>
  );
}
