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
import { ROUTES, EMAIL_REGEX, PASSWORD_MIN_LENGTH } from '@/lib/constants';
import { cn } from '@/lib/utils';

type FieldName = 'email' | 'password' | 'confirmPassword';

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [touched, setTouched] = React.useState<Record<FieldName, boolean>>({
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [serverFieldError, setServerFieldError] = React.useState<{
    field: FieldName;
    message: string;
  } | null>(null);

  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const confirmPasswordRef = React.useRef<HTMLInputElement>(null);

  const refsByField: Record<FieldName, React.RefObject<HTMLInputElement | null>> = {
    email: emailRef,
    password: passwordRef,
    confirmPassword: confirmPasswordRef,
  };

  const errors: Record<FieldName, string | null> = {
    email: !email.trim()
      ? 'Email is required.'
      : !EMAIL_REGEX.test(email.trim())
        ? 'Enter a valid email address.'
        : null,
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

  const showError = (field: FieldName): string | null => {
    if (serverFieldError?.field === field) return serverFieldError.message;
    return touched[field] ? errors[field] : null;
  };

  const markTouched = (field: FieldName) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    if (serverFieldError?.field === field) setServerFieldError(null);
  };

  const handleChange = (field: FieldName, value: string) => {
    if (serverFieldError?.field === field) setServerFieldError(null);
    if (field === 'email') setEmail(value);
    if (field === 'password') setPassword(value);
    if (field === 'confirmPassword') setConfirmPassword(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setServerFieldError(null);
    setTouched({ email: true, password: true, confirmPassword: true });

    const order: FieldName[] = ['email', 'password', 'confirmPassword'];
    const firstInvalid = order.find((f) => errors[f]);
    if (firstInvalid) {
      refsByField[firstInvalid].current?.focus();
      return;
    }

    setIsSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      const raw = signUpError.message;
      if (
        raw.toLowerCase().includes('already registered') ||
        raw.toLowerCase().includes('already in use')
      ) {
        setServerFieldError({
          field: 'email',
          message: 'An account with this email already exists.',
        });
        emailRef.current?.focus();
      } else {
        setServerError(raw);
      }
      setIsSubmitting(false);
      return;
    }

    if (!data.session) {
      toast.success('Account created — check your email to confirm.');
      router.push(ROUTES.login);
      return;
    }

    toast.success('Account created');
    router.push(ROUTES.predictions);
    router.refresh();
  };

  const fieldClass = (field: FieldName) =>
    cn(showError(field) && 'border-destructive focus-visible:ring-destructive');

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
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => markTouched('email')}
          disabled={isSubmitting}
          aria-invalid={showError('email') ? true : undefined}
          aria-describedby={showError('email') ? 'email-error' : undefined}
          className={fieldClass('email')}
        />
        <FieldError id="email-error" message={showError('email') || undefined} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          ref={passwordRef}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => handleChange('password', e.target.value)}
          onBlur={() => markTouched('password')}
          disabled={isSubmitting}
          aria-invalid={showError('password') ? true : undefined}
          aria-describedby={showError('password') ? 'password-error' : undefined}
          className={fieldClass('password')}
        />
        <FieldError id="password-error" message={showError('password') || undefined} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          ref={confirmPasswordRef}
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          onBlur={() => markTouched('confirmPassword')}
          disabled={isSubmitting}
          aria-invalid={showError('confirmPassword') ? true : undefined}
          aria-describedby={
            showError('confirmPassword') ? 'confirmPassword-error' : undefined
          }
          className={fieldClass('confirmPassword')}
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
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link
          href={ROUTES.login}
          className={cn(
            'text-primary hover:underline',
            isSubmitting && 'pointer-events-none opacity-50'
          )}
          tabIndex={isSubmitting ? -1 : undefined}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
