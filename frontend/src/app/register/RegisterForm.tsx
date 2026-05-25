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
import {
  ROUTES,
  EMAIL_REGEX,
  PASSWORD_MIN_LENGTH,
  REFERRAL_CODE_REGEX,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

type FieldName = 'email' | 'password' | 'confirmPassword';

interface RegisterFormProps {
  /** Pre-filled referral code from /register?ref=…, after server-side format check. */
  initialReferralCode?: string;
}

interface ReferralLookup {
  status: 'idle' | 'checking' | 'valid' | 'invalid';
  /** Referrer's username, present when status === 'valid'. */
  referrerUsername?: string;
}

export function RegisterForm({ initialReferralCode }: RegisterFormProps = {}) {
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

  // After a successful signup that requires email confirmation, swap the
  // form for a persistent "Check your email" view (mirrors the pattern in
  // ForgotPasswordForm). `submittedEmail` doubles as the indicator that we
  // are in that mode and as the address shown to the user / used by Resend.
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  // Referral code state. `referralCode` is what the user typed (or what
  // came in via ?ref=). We validate via /api/referrals/validate after a
  // short debounce so the user sees "Invited by @user" or "Invalid invite
  // code" inline. An invalid code never blocks signup — the server-side
  // trigger silently ignores codes it can't resolve.
  const [referralCode, setReferralCode] = React.useState(initialReferralCode ?? '');
  const [referralExpanded, setReferralExpanded] = React.useState(
    Boolean(initialReferralCode)
  );
  const [referralLookup, setReferralLookup] = React.useState<ReferralLookup>({
    status: 'idle',
  });

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  // Debounced referral-code lookup. Aborts in-flight requests when the
  // user keeps typing, and only runs for codes that match the strict
  // format (saves the API hit on every keystroke).
  React.useEffect(() => {
    const trimmed = referralCode.trim().toUpperCase();
    if (!trimmed) {
      setReferralLookup({ status: 'idle' });
      return;
    }
    if (!REFERRAL_CODE_REGEX.test(trimmed)) {
      setReferralLookup({ status: 'invalid' });
      return;
    }
    setReferralLookup({ status: 'checking' });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/referrals/validate?code=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal, cache: 'no-store' }
        );
        if (!res.ok) {
          setReferralLookup({ status: 'invalid' });
          return;
        }
        const json = (await res.json()) as {
          valid: boolean;
          referrerUsername?: string;
        };
        setReferralLookup(
          json.valid
            ? { status: 'valid', referrerUsername: json.referrerUsername }
            : { status: 'invalid' }
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setReferralLookup({ status: 'invalid' });
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [referralCode]);

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

    // Belt-and-suspenders: re-check the phase right before signup. The
    // server-rendered page already gates this, but a tab kept open across
    // a phase transition could otherwise slip through.
    try {
      const phaseRes = await fetch('/api/tournament', { cache: 'no-store' });
      if (phaseRes.ok) {
        const phaseJson = (await phaseRes.json()) as { phase?: string };
        if (phaseJson.phase && phaseJson.phase !== 'phase1') {
          toast.error('Registration is closed — the tournament has already locked.');
          setIsSubmitting(false);
          router.refresh();
          return;
        }
      }
    } catch {
      // If the phase check itself fails, fall through and let the auth
      // call run — the server-rendered gate is still the source of truth.
    }

    const supabase = createSupabaseBrowserClient();
    // Only forward a referral code we've successfully resolved — that way
    // typos / stale links never hit the DB trigger, and we don't leak
    // invalid codes into auth metadata. Invalid codes still proceed with
    // signup (the trigger would silently skip anyway).
    const trimmedRef = referralCode.trim().toUpperCase();
    const passthroughRef =
      referralLookup.status === 'valid' && REFERRAL_CODE_REGEX.test(trimmedRef)
        ? trimmedRef
        : undefined;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: passthroughRef
        ? { data: { referral_code: passthroughRef } }
        : undefined,
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
      // Email confirmation required. Keep the toast for instant feedback,
      // but also swap the form for a persistent "Check your email" view so
      // users can't miss the next step.
      toast.success('Account created — check your email to confirm.');
      setSubmittedEmail(email.trim());
      setIsSubmitting(false);
      return;
    }

    toast.success('Account created');
    router.push(ROUTES.predictions);
    router.refresh();
  };

  const handleResend = async () => {
    if (!submittedEmail || isResending || resendCooldown > 0) return;
    setIsResending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: submittedEmail,
    });
    setIsResending(false);
    if (error) {
      // Supabase enforces its own per-mailbox throttle; surface the message
      // verbatim so users see "you can only request this after N seconds"
      // rather than a generic failure.
      toast.error(error.message);
      return;
    }
    toast.success('Confirmation email resent.');
    setResendCooldown(30);
  };

  const handleTryDifferentAddress = () => {
    setSubmittedEmail(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setTouched({ email: false, password: false, confirmPassword: false });
    setResendCooldown(0);
    // Focus moves on next render once the inputs are back in the DOM.
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const fieldClass = (field: FieldName) =>
    cn(showError(field) && 'border-destructive focus-visible:ring-destructive');

  if (submittedEmail) {
    return (
      <div className="space-y-4">
        <div role="status" aria-live="polite" className="space-y-3">
          <p className="text-foreground text-base font-semibold">Check your email</p>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to{' '}
            <span className="text-foreground font-semibold break-all">{submittedEmail}</span>.
            Click the link to activate your account, then sign in.
          </p>
          <p className="text-muted-foreground text-sm">
            Didn&apos;t get it? Check your spam folder.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className="w-full sm:flex-1"
          >
            {isResending
              ? 'Resending…'
              : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend confirmation email'}
          </Button>
          <Button asChild className="w-full sm:flex-1">
            <Link href={ROUTES.login}>Go to sign in</Link>
          </Button>
        </div>
        <p className="text-muted-foreground text-center text-sm">
          Wrong address?{' '}
          <button
            type="button"
            onClick={handleTryDifferentAddress}
            className="text-primary hover:underline"
          >
            Try a different address
          </button>
          .
        </p>
      </div>
    );
  }

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
      <div className="space-y-2">
        {referralExpanded ? (
          <>
            <Label htmlFor="referralCode">Referral code (optional)</Label>
            <Input
              id="referralCode"
              type="text"
              autoComplete="off"
              inputMode="text"
              maxLength={8}
              value={referralCode}
              onChange={(e) =>
                setReferralCode(e.target.value.toUpperCase().replace(/\s+/g, ''))
              }
              disabled={isSubmitting}
              placeholder="e.g. ABCD1234"
              className="font-mono uppercase tracking-widest"
              aria-describedby="referral-status"
            />
            <p
              id="referral-status"
              className={cn(
                'text-sm',
                referralLookup.status === 'valid' && 'text-green-600 dark:text-green-500',
                referralLookup.status === 'invalid' && 'text-muted-foreground',
                referralLookup.status === 'checking' && 'text-muted-foreground'
              )}
              role="status"
              aria-live="polite"
            >
              {referralLookup.status === 'idle' &&
                'Enter the 8-character code shared by a friend.'}
              {referralLookup.status === 'checking' && 'Checking…'}
              {referralLookup.status === 'valid' && (
                <>
                  Invited by{' '}
                  <span className="font-semibold">@{referralLookup.referrerUsername}</span>
                </>
              )}
              {referralLookup.status === 'invalid' &&
                "We don't recognize that code — you can still sign up without it."}
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setReferralExpanded(true)}
            disabled={isSubmitting}
            className="text-primary text-sm hover:underline disabled:opacity-50"
          >
            Have a referral code?
          </button>
        )}
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
