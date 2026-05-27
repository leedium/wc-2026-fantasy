'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SUPPORT_TICKET_SUBJECT_LABELS,
  type SupportTicketSubject,
} from '@/lib/constants';

interface AdminTicket {
  id: string;
  userId: string;
  username: string | null;
  email: string | null;
  subject: SupportTicketSubject;
  title: string;
  description: string;
  createdAt: string;
}

interface TicketsResponse {
  tickets: AdminTicket[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Failed';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function AdminTicketsList() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminTicket | null>(null);
  const [viewTarget, setViewTarget] = React.useState<AdminTicket | null>(null);

  const query = useQuery<TicketsResponse>({
    queryKey: ['admin-support', page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/support?page=${page}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error('Failed to load tickets');
      return res.json();
    },
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  const refetch = () => queryClient.invalidateQueries({ queryKey: ['admin-support'] });

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <Card>
        <CardContent className="space-y-4 p-4">
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !query.data?.tickets.length ? (
            <p className="text-muted-foreground text-sm">No tickets yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{t.username ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {t.email ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{SUPPORT_TICKET_SUBJECT_LABELS[t.subject]}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm" title={t.title}>
                      {t.title}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => setViewTarget(t)}>
                        View
                      </Button>
                      {t.email ? (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`mailto:${t.email}?subject=${encodeURIComponent(
                              `Re: [ticket ${shortId(t.id)}] ${t.title}`
                            )}`}
                          >
                            Email
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(t)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ViewTicketDialog
        target={viewTarget}
        onOpenChange={(open) => !open && setViewTarget(null)}
      />
      <DeleteTicketDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onDeleted={refetch}
      />
    </PageLayout>
  );
}

function ViewTicketDialog({
  target,
  onOpenChange,
}: {
  target: AdminTicket | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = target !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{target?.title ?? 'Ticket'}</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                {SUPPORT_TICKET_SUBJECT_LABELS[target.subject]} ·{' '}
                {target.username ?? 'unknown user'} · {formatDate(target.createdAt)}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {target ? (
          <p className="text-sm whitespace-pre-wrap">{target.description}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTicketDialog({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: AdminTicket | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const open = target !== null;
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (target) setSubmitting(false);
  }, [target]);

  const handleConfirm = async () => {
    if (!target) return;
    setSubmitting(true);
    const res = await fetch('/api/admin/support', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success('Ticket deleted');
    onDeleted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete ticket?</DialogTitle>
          <DialogDescription>
            This will permanently remove the ticket. Use this after you&apos;ve replied to the
            user out-of-band.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
