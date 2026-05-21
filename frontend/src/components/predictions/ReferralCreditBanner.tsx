'use client';

import * as React from 'react';
import Link from 'next/link';
import { Gift, X } from 'lucide-react';

import { useAuthContext } from '@/providers/AuthProvider';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Dismissible banner shown on /predictions when the signed-in user has
 * unredeemed referral credits. Mirrors the LockStatusBanner pattern:
 * sessionStorage-based dismissal keyed on (userId, creditCount) so a
 * new credit arriving re-shows the banner even after the user dismissed
 * the previous one.
 */
function dismissKey(userId: string, count: number): string {
  return `wc2026:referral-banner:${userId}:${count}`;
}

export function ReferralCreditBanner() {
  const { user } = useAuthContext();
  const { status } = useReferralStatus();
  const [dismissed, setDismissed] = React.useState(false);

  const credits = status.availableCredits;
  const userId = user?.id ?? null;

  React.useEffect(() => {
    if (!userId || credits <= 0 || typeof window === 'undefined') {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(
        window.sessionStorage.getItem(dismissKey(userId, credits)) === '1'
      );
    } catch {
      setDismissed(false);
    }
  }, [userId, credits]);

  const handleDismiss = React.useCallback(() => {
    if (!userId || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(dismissKey(userId, credits), '1');
    } catch {
      // best-effort
    }
    setDismissed(true);
  }, [userId, credits]);

  if (!userId || credits <= 0 || dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        'rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm',
        'flex items-start gap-3 dark:border-green-500/30 dark:bg-green-500/10'
      )}
    >
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-400" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-green-900 dark:text-green-100">
          {credits === 1
            ? 'You earned a free pick from a referral!'
            : `You earned ${credits} free picks from referrals!`}
        </p>
        <p className="text-muted-foreground mt-1">
          Pick an unpaid bracket below and click <strong>Use free credit</strong>{' '}
          to apply it. See your{' '}
          <Link href={ROUTES.referrals} className="text-primary hover:underline">
            referral status
          </Link>{' '}
          for details.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="text-muted-foreground -mr-1 inline-flex h-6 w-6 items-center justify-center rounded transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
