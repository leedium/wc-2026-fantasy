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
import { ReferralActivityCard } from '@/components/referrals/ReferralActivityCard';
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
  const { refreshProfile } = useAuthContext();
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
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" type="email" value={email} readOnly disabled />
              <p className="text-muted-foreground text-xs">
                Email is set at signup and can&apos;t be changed here.
              </p>
            </div>
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

      {/* Read-only snapshot of the user's referral activity. The share
          link + code copy controls live on the dedicated /referrals
          page; the link below sends users there for those. */}
      <div className="mt-6 max-w-xl space-y-2">
        <ReferralActivityCard />
        <p className="text-muted-foreground text-sm">
          Want to invite a friend?{' '}
          <Link href={ROUTES.referrals} className="text-primary hover:underline">
            Get your referral link
          </Link>
          .
        </p>
      </div>
    </PageLayout>
  );
}
