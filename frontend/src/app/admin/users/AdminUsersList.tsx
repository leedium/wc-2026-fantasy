'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useAuthContext } from '@/providers/AuthProvider';
import {
  EMAIL_REGEX,
  PASSWORD_MIN_LENGTH,
  REFERRAL_CODE_REGEX,
  USERNAME_REGEX,
} from '@/lib/constants';

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  predictionCount: number;
  paidPredictionCount: number;
  totalRewards: number;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  tournament: { id: string; lockTime: string } | null;
}

const PAGE_SIZE = 25;

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Failed';
}

export function AdminUsersList() {
  const queryClient = useQueryClient();
  const { user: currentUser, profile } = useAuthContext();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [page, setPage] = React.useState(1);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = React.useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminUser | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery<UsersResponse>({
    queryKey: ['admin-users', debounced, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(debounced)}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  // Invalidate both the list and the admin dashboard stats — the stats RPC
  // counts registrations and renders usernames in top_paid_users, so create
  // / edit / delete user can leave the dashboard stale otherwise.
  const refetchUsers = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
    ]);

  const toggleAdmin = async (user: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !user.isAdmin }),
      });
      if (!res.ok) throw new Error(await readError(res));
      toast.success(`${user.username} ${!user.isAdmin ? 'promoted to admin' : 'demoted'}`);
      await refetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const isSelf = (user: AdminUser) => currentUser?.id === user.id;

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Input
              placeholder="Search username, email, or prediction name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-sm"
            />
            <Button onClick={() => setCreateOpen(true)}>Create user</Button>
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Predictions</TableHead>
                  <TableHead title="Lifetime referral credits earned + active-tournament loyalty credits earned">
                    Total rewards
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-sm">
                      {u.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      {u.isSuperAdmin ? (
                        <Badge title="Cannot be demoted or deleted">super admin</Badge>
                      ) : u.isAdmin ? (
                        <Badge>admin</Badge>
                      ) : (
                        <Badge variant="outline">user</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.predictionCount > 0 ? (
                        <span>
                          <span className="font-medium">{u.paidPredictionCount}</span>
                          <span className="text-muted-foreground"> / {u.predictionCount} paid</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.totalRewards > 0 ? (
                        <span className="font-medium">{u.totalRewards}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/users/${u.id}`}>Manage predictions</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAdmin(u)}
                        disabled={u.isSuperAdmin}
                        title={u.isSuperAdmin ? 'Super admin cannot be demoted' : undefined}
                      >
                        {u.isAdmin ? 'Demote' : 'Promote'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditTarget(u)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetTarget(u)}
                      >
                        Reset password
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={u.isSuperAdmin || u.isAdmin || isSelf(u)}
                        title={
                          u.isSuperAdmin
                            ? 'Super admin cannot be deleted'
                            : u.isAdmin
                              ? 'Demote first'
                              : isSelf(u)
                                ? 'Cannot delete yourself'
                                : undefined
                        }
                        onClick={() => setDeleteTarget(u)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(query.data?.users ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-muted-foreground text-sm">
                Page {page} of {totalPages} · {query.data?.total ?? 0} users
              </p>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refetchUsers}
      />
      <EditUserDialog
        target={editTarget}
        canEditReferralCode={!!profile?.isSuperAdmin}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={refetchUsers}
      />
      <ResetPasswordDialog
        target={resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
      />
      <DeleteUserDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onDeleted={refetchUsers}
      />
    </PageLayout>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setEmail('');
      setUsername('');
      setPassword('');
      setDisplayName('');
      setTouched({});
      setServerError(null);
      setSubmitting(false);
    }
  }, [open]);

  const errors = {
    email: !email.trim()
      ? 'Email is required.'
      : !EMAIL_REGEX.test(email.trim())
        ? 'Enter a valid email address.'
        : null,
    username: !username.trim()
      ? 'Username is required.'
      : !USERNAME_REGEX.test(username.trim())
        ? 'Username must be 3–24 chars, letters/numbers/underscore only.'
        : null,
    password:
      password.length < PASSWORD_MIN_LENGTH
        ? `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
        : null,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, username: true, password: true });
    setServerError(null);
    if (errors.email || errors.username || errors.password) return;

    setSubmitting(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        username: username.trim(),
        password,
        displayName: displayName.trim() || null,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      setServerError(await readError(res));
      return;
    }
    toast.success(`Created ${username}`);
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>Provision an account on behalf of a participant.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
            {touched.email && (
              <FieldError id="create-email-error" message={errors.email} />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-username">Username</Label>
            <Input
              id="create-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
            />
            {touched.username && (
              <FieldError id="create-username-error" message={errors.username} />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
            {touched.password && (
              <FieldError id="create-password-error" message={errors.password} />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-display-name">Display name (optional)</Label>
            <Input
              id="create-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <FieldError id="create-server-error" message={serverError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  target,
  canEditReferralCode,
  onOpenChange,
  onSaved,
}: {
  target: AdminUser | null;
  canEditReferralCode: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const open = target !== null;
  const [username, setUsername] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (target) {
      setUsername(target.username);
      setDisplayName('');
      setTouched(false);
      setServerError(null);
      setSubmitting(false);
    }
  }, [target]);

  const usernameError =
    !username.trim()
      ? 'Username is required.'
      : !USERNAME_REGEX.test(username.trim())
        ? 'Username must be 3–24 chars, letters/numbers/underscore only.'
        : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setTouched(true);
    setServerError(null);
    if (usernameError) return;

    setSubmitting(true);
    const res = await fetch(`/api/admin/users/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim(),
        displayName: displayName.trim() || null,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      setServerError(await readError(res));
      return;
    }
    toast.success(`Updated ${target.username}`);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {target ? `Update profile for ${target.username}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={target?.email ?? ''}
              readOnly
              disabled
              placeholder={target?.email ? undefined : 'Unavailable'}
            />
            <p className="text-muted-foreground text-xs">
              Email is managed through Supabase Auth and can&apos;t be changed here.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-username">Username</Label>
            <Input
              id="edit-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            {touched && <FieldError id="edit-username-error" message={usernameError} />}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-display-name">Display name (optional)</Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Leave blank to clear"
            />
          </div>
          <FieldError id="edit-server-error" message={serverError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
        {canEditReferralCode && target && (
          <ReferralCodeSection userId={target.id} open={open} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Super-admin-only referral-code override, shown inside the Edit user dialog.
// Independent of the username form (its own Save), so it never piggybacks on
// the profile PATCH. The PATCH route's coarse gate is is_admin; the super-admin
// requirement is enforced in the admin_set_referral_code RPC.
function ReferralCodeSection({ userId, open }: { userId: string; open: boolean }) {
  const query = useQuery<{ overview: { referralCode: string | null } }>({
    queryKey: ['admin-referral-code', userId],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/admin/referrals?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to load referral code');
      return res.json();
    },
  });
  const currentCode = query.data?.overview.referralCode ?? null;

  const [codeInput, setCodeInput] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Seed the input with the current code once it loads (and after a save).
  React.useEffect(() => {
    if (currentCode) setCodeInput(currentCode);
  }, [currentCode]);

  const trimmedCode = codeInput.trim().toUpperCase();
  const codeValid = REFERRAL_CODE_REGEX.test(trimmedCode);
  const unchanged = currentCode != null && trimmedCode === currentCode.toUpperCase();
  const canSave = codeValid && note.trim().length > 0 && !unchanged && !busy;

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/referral-code`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, note: note.trim() }),
      });
      if (!res.ok) throw new Error(await readError(res));
      toast.success(`Referral code set to ${trimmedCode}`);
      setNote('');
      await query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium">Referral code (super admin)</p>
        <p className="text-muted-foreground text-xs">
          Override the auto-generated code with a vanity code, e.g. an influencer&apos;s handle.
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Current code</Label>
        <p className="font-mono text-sm font-medium">
          {query.isLoading ? '…' : (currentCode ?? '—')}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="edit-referral-code">New code (4–32 chars, A–Z and 0–9)</Label>
        <Input
          id="edit-referral-code"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
          maxLength={32}
          disabled={busy}
          className="font-mono uppercase tracking-widest"
          placeholder="e.g. GIUSEPPETHEMC"
          aria-invalid={codeInput.length > 0 && !codeValid ? true : undefined}
        />
        {codeInput.length > 0 && !codeValid && (
          <FieldError
            id="edit-referral-code-error"
            message="Code must be 4–32 characters, using only A–Z and 0–9."
          />
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="edit-referral-note">Reason (audit note, required)</Label>
        <Input
          id="edit-referral-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          placeholder="e.g. influencer vanity code"
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {busy ? 'Saving…' : 'Save code'}
        </Button>
      </div>
    </div>
  );
}

function ResetPasswordDialog({
  target,
  onOpenChange,
}: {
  target: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = target !== null;
  const [submitting, setSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    if (!target) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/users/${target.id}/password-reset`, {
      method: 'POST',
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success(`Recovery email sent to ${target.username}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send password reset?</DialogTitle>
          <DialogDescription>
            {target
              ? `Email a recovery link to ${target.username}. They'll set a new password themselves.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const open = target !== null;
  const [confirmText, setConfirmText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (target) {
      setConfirmText('');
      setSubmitting(false);
    }
  }, [target]);

  const matches = !!target && confirmText === target.username;

  const handleConfirm = async () => {
    if (!target || !matches) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/users/${target.id}`, { method: 'DELETE' });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(await readError(res));
      return;
    }
    toast.success(`Deleted ${target.username}`);
    onDeleted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            {target
              ? `This will permanently delete ${target.username} and all their predictions and payments. To confirm, type the username below.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono">{target?.username}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
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
            disabled={!matches || submitting}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
