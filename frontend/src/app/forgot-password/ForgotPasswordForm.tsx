'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const fieldError = !identifier.trim() ? 'Email or username is required.' : null;
  const showError = touched && fieldError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setTouched(true);

    if (fieldError) {
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (!res.ok) {
        setServerError('Something went wrong. Please try again.');
        setIsSubmitting(false);
        return;
      }
      setSubmitted(true);
      setIsSubmitting(false);
    } catch {
      setServerError('Network error. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <p className="text-sm" role="status">
          If an account matches, we&apos;ve sent a reset link. Check your inbox (and spam folder)
          and follow the instructions.
        </p>
        <p className="text-muted-foreground text-sm">
          Didn&apos;t get an email?{' '}
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setIdentifier('');
              setTouched(false);
              inputRef.current?.focus();
            }}
            className="text-primary hover:underline"
          >
            Try a different address
          </button>
          .
        </p>
        <p className="text-muted-foreground text-center text-sm">
          <Link href={ROUTES.login} className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or username</Label>
        <Input
          id="identifier"
          ref={inputRef}
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={isSubmitting}
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? 'identifier-error' : undefined}
          className={cn(
            showError && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        <FieldError id="identifier-error" message={showError || undefined} />
      </div>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Remembered it?{' '}
        <Link
          href={ROUTES.login}
          className={cn(
            'text-primary hover:underline',
            isSubmitting && 'pointer-events-none opacity-50'
          )}
          tabIndex={isSubmitting ? -1 : undefined}
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
