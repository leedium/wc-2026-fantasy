'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift, Search, X } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldError } from '@/components/ui/field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAdminReferralDetail,
  adminReferralDetailKey,
  type AdminReferee,
} from '@/hooks/useAdminReferralDetail';

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Failed';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AdminReferrals() {
  const [selected, setSelected] = React.useState<AdminUser | null>(null);

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <div className="space-y-6">
        <MemberPicker selected={selected} onSelect={setSelected} />
        {selected ? (
          <MemberDetail member={selected} />
        ) : (
          <Card>
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
              <Gift className="h-8 w-8" aria-hidden />
              <p>Search a member above to view and manage their referrals.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}

function MemberPicker({
  selected,
  onSelect,
}: {
  selected: AdminUser | null;
  onSelect: (u: AdminUser | null) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery<{ users: AdminUser[] }>({
    queryKey: ['admin-users', 'referral-picker', debounced],
    enabled: debounced.length >= 1,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(debounced)}&page=1&pageSize=10`
      );
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Label htmlFor="member-search">Member</Label>
        {selected ? (
          <div className="flex items-center justify-between gap-2 rounded-md border p-3">
            <div className="text-sm">
              <span className="font-medium">{selected.username}</span>
              <span className="text-muted-foreground"> · {selected.email ?? 'no email'}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelect(null);
                setSearch('');
                setDebounced('');
              }}
            >
              <X className="mr-1 h-4 w-4" /> Change
            </Button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
              <Input
                id="member-search"
                placeholder="Search by username or email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                className="pl-8"
                autoComplete="off"
              />
            </div>
            {open && debounced.length >= 1 && (
              <div className="bg-popover absolute z-10 mt-1 w-full overflow-hidden rounded-md border shadow-md">
                {query.isLoading ? (
                  <div className="p-3">
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : (query.data?.users ?? []).length === 0 ? (
                  <p className="text-muted-foreground p-3 text-sm">No members found</p>
                ) : (
                  <ul className="max-h-72 overflow-auto">
                    {(query.data?.users ?? []).map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="hover:bg-accent w-full px-3 py-2 text-left text-sm"
                          onClick={() => {
                            onSelect(u);
                            setOpen(false);
                          }}
                        >
                          <span className="font-medium">{u.username}</span>
                          <span className="text-muted-foreground"> · {u.email ?? 'no email'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberDetail({ member }: { member: AdminUser }) {
  const { data, isLoading } = useAdminReferralDetail(member.id);
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<AdminReferee | null>(null);

  const overview = data?.overview;
  const toNext = overview ? overview.qualifiedTotal % 4 : 0;

  return (
    <>
      {/* Summary band */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            {member.username}&apos;s referrals
          </CardTitle>
          <Button onClick={() => setApplyOpen(true)}>Apply a referral</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || !overview ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                <Stat label="Qualified referrals" value={overview.qualifiedTotal} />
                <Stat label="Earned free picks" value={overview.earnedCredits} />
                <Stat label="Redeemed" value={overview.redeemedTotal} />
                <Stat
                  label="Available now"
                  value={overview.availableCredits}
                  emphasis={overview.availableCredits > 0}
                />
              </div>
              <div className="space-y-1">
                <Progress value={(toNext / 4) * 100} />
                <p className="text-muted-foreground text-sm">
                  <strong>
                    {toNext}/4
                  </strong>{' '}
                  toward next free pick · referral code{' '}
                  <span className="font-mono">{overview.referralCode ?? '—'}</span>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Referees table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referees ({data?.referees.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Linked on</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.referees ?? []).map((r) => (
                  <TableRow key={r.refereeId}>
                    <TableCell className="font-medium">{r.refereeUsername}</TableCell>
                    <TableCell className="text-sm">{r.refereeEmail ?? '—'}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      {r.source === 'admin' ? (
                        <Badge variant="secondary">Admin-applied</Badge>
                      ) : (
                        <Badge variant="outline">Organic</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.qualifiedAt ? (
                        <span className="text-green-600 dark:text-green-400">
                          Qualified · {formatDate(r.qualifiedAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pending payment</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRemoveTarget(r)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.referees ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                      No referees yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inbound strip */}
      {data?.inbound && (
        <Card>
          <CardContent className="text-muted-foreground py-3 text-sm">
            Referred by{' '}
            <span className="text-foreground font-medium">
              {data.inbound.referrerUsername}
            </span>{' '}
            on {formatDate(data.inbound.createdAt)}
            {data.inbound.source === 'admin' && ' (admin-applied)'}
          </CardContent>
        </Card>
      )}

      {/* Audit history */}
      <AuditHistory entries={data?.audit ?? []} loading={isLoading} />

      <ApplyReferralDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        referrer={member}
      />
      <RemoveRefereeDialog
        target={removeTarget}
        referrerId={member.id}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      />
    </>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div
        className={
          emphasis
            ? 'text-2xl font-bold text-green-600 dark:text-green-400'
            : 'text-2xl font-bold'
        }
      >
        {value}
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

function AuditHistory({
  entries,
  loading,
}: {
  entries: import('@/hooks/useAdminReferralDetail').AdminReferralAuditEntry[];
  loading: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex w-full items-center justify-between"
          onClick={() => setOpen((o) => !o)}
        >
          <CardTitle className="text-base">Admin history ({entries.length})</CardTitle>
          <span className="text-muted-foreground text-sm">{open ? 'Hide' : 'Show'}</span>
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No admin actions recorded.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id} className="border-b pb-3 text-sm last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={e.action === 'add' ? 'default' : 'destructive'}>
                      {e.action}
                    </Badge>
                    <span className="font-medium">
                      {e.refereeUsername ?? e.refereeEmail ?? 'unknown'}
                    </span>
                    <span className="text-muted-foreground">
                      by {e.actorUsername ?? 'unknown'} · {formatDate(e.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">{e.note}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface ResolveResult {
  found: boolean;
  refereeId?: string;
  username?: string;
  hasPaid?: boolean;
  currentReferrerId?: string | null;
  currentReferrerUsername?: string | null;
}

function ApplyReferralDialog({
  open,
  onOpenChange,
  referrer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referrer: AdminUser;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setEmail('');
      setDebounced('');
      setNote('');
      setSubmitting(false);
      setServerError(null);
    }
  }, [open]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(email.trim()), 350);
    return () => clearTimeout(t);
  }, [email]);

  const resolve = useQuery<ResolveResult>({
    queryKey: ['admin-resolve-referee', debounced],
    enabled: open && debounced.includes('@'),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/referrals/resolve?email=${encodeURIComponent(debounced)}`
      );
      if (!res.ok) throw new Error('Failed to resolve');
      return res.json();
    },
  });

  const r = resolve.data;
  const isSelf = r?.found && r.refereeId === referrer.id;
  const alreadyReferred = r?.found && !!r.currentReferrerId;
  const creditable = !!r?.found && !isSelf && !alreadyReferred;
  const canSubmit = creditable && note.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    const res = await fetch('/api/admin/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referrerId: referrer.id,
        refereeEmail: debounced,
        note: note.trim(),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setServerError(await readError(res));
      return;
    }
    const body = (await res.json()) as { qualified?: boolean };
    toast.success(
      body.qualified
        ? `Linked ${r?.username} — qualified immediately`
        : `Linked ${r?.username} — qualifies on first payment`
    );
    await queryClient.invalidateQueries({ queryKey: adminReferralDetailKey(referrer.id) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply a referral</DialogTitle>
          <DialogDescription>
            Link a referee account to <span className="font-medium">{referrer.username}</span>. The
            referee must already have an account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="referee-email">Referee email</Label>
            <Input
              id="referee-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              placeholder="friend@example.com"
            />
            <div className="min-h-5 text-sm" aria-live="polite">
              {debounced.includes('@') && resolve.isLoading && (
                <span className="text-muted-foreground">Looking up…</span>
              )}
              {debounced.includes('@') && !resolve.isLoading && r && (
                <>
                  {!r.found && <span className="text-destructive">No account found</span>}
                  {isSelf && (
                    <span className="text-destructive">That&apos;s this member</span>
                  )}
                  {alreadyReferred && (
                    <span className="text-destructive">
                      Already referred by {r.currentReferrerUsername}
                    </span>
                  )}
                  {creditable && (
                    <span className="text-green-600 dark:text-green-400">
                      ✓ {r.username} ·{' '}
                      {r.hasPaid
                        ? 'already paid → qualifies immediately'
                        : 'not yet paid → qualifies on first payment'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="referral-note">Proof / reason</Label>
            <Input
              id="referral-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. screenshot of email invite"
            />
          </div>
          <FieldError id="apply-server-error" message={serverError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? 'Applying…' : 'Apply referral'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveRefereeDialog({
  target,
  referrerId,
  onOpenChange,
}: {
  target: AdminReferee | null;
  referrerId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const open = target !== null;
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (target) {
      setNote('');
      setSubmitting(false);
    }
  }, [target]);

  const handleConfirm = async () => {
    if (!target || !note.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/admin/referrals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refereeId: target.refereeId, note: note.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success(`Removed ${target.refereeUsername}`);
    await queryClient.invalidateQueries({ queryKey: adminReferralDetailKey(referrerId) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove referral?</DialogTitle>
          <DialogDescription>
            {target
              ? `Unlink ${target.refereeUsername} from this member. Any already-redeemed free pick stays valid.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="remove-note">Proof / reason</Label>
          <Input
            id="remove-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. duplicate / disputed"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!note.trim() || submitting}
          >
            {submitting ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
