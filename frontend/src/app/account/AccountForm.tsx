'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RewardsSummaryCard } from '@/components/rewards/RewardsSummaryCard';
import { useAuthContext } from '@/providers/AuthProvider';
import { ROUTES, USERNAME_REGEX } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface AccountFormProps {
  email: string;
  initialUsername: string;
  initialDisplayName: string;
}

export function AccountForm({ email, initialUsername, initialDisplayName }: AccountFormProps) {
  const router = useRouter();
  const { refreshProfile, signOut } = useAuthContext();
  const [username, setUsername] = React.useState(initialUsername);
  const [displayName, setDisplayName] = React.useState(initialDisplayName);
  const [touched, setTouched] = React.useState<Record<'username' | 'displayName', boolean>>({
    username: false,
    displayName: false,
  });
  const [serverFieldError, setServerFieldError] = React.useState<{
    field: 'username' | 'displayName';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const usernameRef = React.useRef<HTMLInputElement>(null);

  const usernameError = !username.trim()
    ? 'Username is required.'
    : !USERNAME_REGEX.test(username.trim())
      ? 'Username must be 3–24 characters, letters, numbers, or underscores.'
      : null;
  const displayNameError =
    displayName.length > 50 ? 'Display name must be 50 characters or fewer.' : null;

  const showError = (field: 'username' | 'displayName'): string | null => {
    if (serverFieldError?.field === field) return serverFieldError.message;
    if (field === 'username' && touched.username) return usernameError;
    if (field === 'displayName' && touched.displayName) return displayNameError;
    return null;
  };

  const isDirty =
    username.trim() !== initialUsername || displayName.trim() !== initialDisplayName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, displayName: true });
    setServerFieldError(null);
    if (usernameError) {
      usernameRef.current?.focus();
      return;
    }
    if (displayNameError) return;
    if (!isDirty) {
      toast.info('No changes to save.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || null,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = String(errBody.error ?? 'Failed to save');
        if (msg.includes('username taken')) {
          setServerFieldError({ field: 'username', message: 'That username is already taken.' });
          usernameRef.current?.focus();
          return;
        }
        if (msg.includes('username invalid format')) {
          setServerFieldError({
            field: 'username',
            message: 'Username must be 3–24 characters, letters, numbers, or underscores.',
          });
          usernameRef.current?.focus();
          return;
        }
        throw new Error(msg);
      }
      toast.success('Account updated');
      await refreshProfile();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Account settings</h1>
        <p className="text-muted-foreground">
          Update your display name and username. Your username appears on the leaderboard alongside
          each of your prediction names.
        </p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="account-username">Username</Label>
              <Input
                id="account-username"
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (serverFieldError?.field === 'username') setServerFieldError(null);
                }}
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                disabled={isSubmitting}
                aria-invalid={showError('username') ? true : undefined}
                aria-describedby={
                  showError('username') ? 'account-username-error' : 'account-username-help'
                }
                className={cn(
                  showError('username') && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {!showError('username') && (
                <p id="account-username-help" className="text-muted-foreground text-xs">
                  3–24 characters. Letters, numbers, and underscores only. Must be unique.
                </p>
              )}
              <FieldError
                id="account-username-error"
                message={showError('username') || undefined}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-display-name">Display name (optional)</Label>
              <Input
                id="account-display-name"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (serverFieldError?.field === 'displayName') setServerFieldError(null);
                }}
                onBlur={() => setTouched((t) => ({ ...t, displayName: true }))}
                disabled={isSubmitting}
                maxLength={50}
                placeholder="Leave blank to clear"
              />
              <FieldError
                id="account-display-name-error"
                message={showError('displayName') || undefined}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <EmailCard currentEmail={email} />

      {/* Compact free-pick summary. Full breakdown (referral + loyalty
          activity) lives on /rewards; share-link copy controls live on
          /referrals. */}
      <div className="mt-6 max-w-xl space-y-2">
        <RewardsSummaryCard />
        <p className="text-muted-foreground text-sm">
          Want to invite a friend?{' '}
          <Link href={ROUTES.referrals} className="text-primary hover:underline">
            Get your referral link
          </Link>
          .
        </p>
      </div>

      <DangerZoneCard
        username={initialUsername}
        onDeleted={async () => {
          await signOut();
          router.push(ROUTES.home);
        }}
      />
    </PageLayout>
  );
}

function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = newEmail.trim();
    if (!email) {
      setError('Enter a new email address.');
      return;
    }
    if (email.toLowerCase() === currentEmail.toLowerCase()) {
      setError('That is already your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(String(body.error ?? 'Could not update email.'));
        return;
      }
      setNewEmail('');
      toast.success('Check both your current and new inbox to confirm the change.');
    } catch {
      toast.error('Could not update email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mt-6 max-w-xl">
      <CardHeader>
        <CardTitle>Email</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <Label htmlFor="account-current-email">Current email</Label>
            <Input id="account-current-email" type="email" value={currentEmail} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label htmlFor="account-new-email">New email</Label>
            <Input
              id="account-new-email"
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'account-new-email-error' : 'account-new-email-help'}
              className={cn(error && 'border-destructive focus-visible:ring-destructive')}
            />
            {!error && (
              <p id="account-new-email-help" className="text-muted-foreground text-xs">
                We&apos;ll send confirmation links to both your current and new address. The change
                takes effect only after you click both.
              </p>
            )}
            <FieldError id="account-new-email-error" message={error || undefined} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !newEmail.trim()}>
              {isSubmitting ? 'Sending…' : 'Send confirmation'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DangerZoneCard({
  username,
  onDeleted,
}: {
  username: string;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [confirmValue, setConfirmValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const matches = confirmValue.trim().toLowerCase() === username.toLowerCase() && !!username;

  const handleOpenChange = (next: boolean) => {
    if (isDeleting) return;
    setOpen(next);
    if (!next) {
      setConfirmValue('');
      setError(null);
    }
  };

  const handleDelete = async () => {
    if (!matches) return;
    setError(null);
    setIsDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmUsername: confirmValue.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = String(body.error ?? 'Could not delete account.');
        if (msg.includes('account has paid entries')) {
          setError(
            'Your account has paid entries on the leaderboard. Please contact the pool organizer to remove them before deleting your account.'
          );
          return;
        }
        if (msg.includes('cannot delete admin account')) {
          setError('Admin accounts can’t be deleted here. Please contact the organizer.');
          return;
        }
        setError(msg);
        return;
      }
      toast.success('Your account has been deleted.');
      await onDeleted();
    } catch {
      setError('Could not delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/50 mt-6 max-w-xl">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Permanently delete your account. This removes your predictions, payment records, and
          referral links. This cannot be undone.
        </p>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account along with all of your predictions, payment
              records, and referral links. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type your username <span className="font-semibold">{username}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              type="text"
              value={confirmValue}
              onChange={(e) => {
                setConfirmValue(e.target.value);
                if (error) setError(null);
              }}
              disabled={isDeleting}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'delete-confirm-error' : undefined}
            />
            <FieldError id="delete-confirm-error" message={error || undefined} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={!matches || isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
