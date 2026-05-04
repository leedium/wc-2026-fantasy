'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ROUTES, EMAIL_REGEX } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface LoginFormProps {
  redirectTo: string;
}

type FieldName = 'email' | 'password';

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [touched, setTouched] = React.useState<Record<FieldName, boolean>>({
    email: false,
    password: false,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  const errors: Record<FieldName, string | null> = {
    email: !email.trim()
      ? 'Email is required.'
      : !EMAIL_REGEX.test(email.trim())
        ? 'Enter a valid email address.'
        : null,
    password: !password ? 'Password is required.' : null,
  };

  const showError = (field: FieldName) => touched[field] && errors[field];

  const markTouched = (field: FieldName) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setTouched({ email: true, password: true });

    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setServerError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    toast.success('Signed in');
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          ref={emailRef}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => markTouched('email')}
          disabled={isSubmitting}
          aria-invalid={showError('email') ? true : undefined}
          aria-describedby={showError('email') ? 'email-error' : undefined}
          className={cn(showError('email') && 'border-destructive focus-visible:ring-destructive')}
        />
        <FieldError id="email-error" message={showError('email') || undefined} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          ref={passwordRef}
          type="password"
          autoComplete="current-password"
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
        <div className="flex justify-end">
          <Link
            href={ROUTES.forgotPassword}
            className={cn(
              'text-primary text-xs hover:underline',
              isSubmitting && 'pointer-events-none opacity-50'
            )}
            tabIndex={isSubmitting ? -1 : undefined}
          >
            Forgot password?
          </Link>
        </div>
      </div>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link
          href={ROUTES.register}
          className={cn(
            'text-primary hover:underline',
            isSubmitting && 'pointer-events-none opacity-50'
          )}
          tabIndex={isSubmitting ? -1 : undefined}
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
