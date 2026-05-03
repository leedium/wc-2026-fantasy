'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/lib/constants';

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        setIsSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <p className="text-sm" role="status">
          If an account matches, we&apos;ve sent a reset link. Check your inbox and follow the
          instructions.
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
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Remembered it?{' '}
        <Link href={ROUTES.login} className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
