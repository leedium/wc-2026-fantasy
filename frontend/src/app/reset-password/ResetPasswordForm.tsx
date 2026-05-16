'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { ROUTES, PASSWORD_MIN_LENGTH } from '@/lib/constants';
import { cn } from '@/lib/utils';

type FieldName = 'password' | 'confirmPassword';

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [touched, setTouched] = React.useState<Record<FieldName, boolean>>({
    password: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const confirmRef = React.useRef<HTMLInputElement>(null);

  const errors: Record<FieldName, string | null> = {
    password: !password
      ? 'Password is required.'
      : password.length < PASSWORD_MIN_LENGTH
        ? `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
        : null,
    confirmPassword: !confirmPassword
      ? 'Please confirm your password.'
      : password !== confirmPassword
        ? 'Passwords do not match.'
        : null,
  };

  const showError = (field: FieldName) => touched[field] && errors[field];

  const markTouched = (field: FieldName) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setTouched({ password: true, confirmPassword: true });

    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }
    if (errors.confirmPassword) {
      confirmRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(body.error ?? 'Could not update password. Please try again.');
        setIsSubmitting(false);
        return;
      }
    } catch {
      setServerError('Network error. Please try again.');
      setIsSubmitting(false);
      return;
    }

    router.push(`${ROUTES.login}?reset=success`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          ref={passwordRef}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => markTouched('password')}
          disabled={isSubmitting}
          aria-invalid={showError('password') ? true : undefined}
          aria-describedby={showError('password') ? 'password-error' : undefined}
          className={cn(
            showError('password') && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        <FieldError id="password-error" message={showError('password') || undefined} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          ref={confirmRef}
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => markTouched('confirmPassword')}
          disabled={isSubmitting}
          aria-invalid={showError('confirmPassword') ? true : undefined}
          aria-describedby={
            showError('confirmPassword') ? 'confirmPassword-error' : undefined
          }
          className={cn(
            showError('confirmPassword') && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        <FieldError
          id="confirmPassword-error"
          message={showError('confirmPassword') || undefined}
        />
      </div>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
