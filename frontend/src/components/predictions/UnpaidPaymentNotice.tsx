'use client';

import * as React from 'react';
import { AlertTriangle, Mail } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PAYMENTS_EMAIL, PRICING } from '@/lib/constants';

/**
 * Urgent, persistent red notice shown to a signed-in user who has submitted
 * predictions that haven't been marked paid yet. Used identically on
 * `/predictions` and `/leaderboard` so the payment call-to-action reads the
 * same everywhere.
 *
 * Intentionally NOT dismissible: an unmet payment obligation shouldn't be
 * silenceable. It returns `null` once `unpaidCount` hits 0, so it disappears on
 * its own when an admin marks the entries paid.
 *
 * Presentational only — the caller computes the count of submitted-but-unpaid
 * predictions and passes the registered account email.
 */
export function UnpaidPaymentNotice({
  unpaidCount,
  email,
}: {
  unpaidCount: number;
  email: string | null;
}) {
  if (unpaidCount <= 0) return null;

  const plural = unpaidCount === 1 ? 'prediction' : 'predictions';
  const totalDue = unpaidCount * PRICING.entryFeeCAD;
  const emailLabel = email ?? 'your registered email';

  const mailtoSubject = encodeURIComponent(
    `World Cup 2026 pool payment${email ? ` — ${email}` : ''}`
  );
  const mailtoBody = encodeURIComponent(
    `Hi,\n\nI'm sending an Interac e-transfer for ${unpaidCount} ${plural} ($${totalDue} ${PRICING.currency} total).\n\nRegistered account email: ${email ?? '(add your account email)'}\n`
  );

  return (
    <Card
      role="alert"
      className="mb-6 border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200"
    >
      <CardContent className="flex items-start gap-3 py-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
        <div className="flex-1 space-y-2">
          <p className="font-semibold">
            Action needed: you have {unpaidCount} unpaid {plural}
          </p>
          <p className="text-sm">
            Each entry is{' '}
            <span className="font-semibold">
              ${PRICING.entryFeeCAD} {PRICING.currency}
            </span>{' '}
            and won&apos;t be ranked on the leaderboard until payment is recorded
            (total due:{' '}
            <span className="font-semibold">
              ${totalDue} {PRICING.currency}
            </span>
            ). Send an <span className="font-semibold">Interac e-transfer</span> to{' '}
            <a
              href={`mailto:${PAYMENTS_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`}
              className="font-medium underline underline-offset-2"
            >
              {PAYMENTS_EMAIL}
            </a>{' '}
            and <span className="font-semibold">include your registered email</span> (
            <span className="font-medium break-all">{emailLabel}</span>) in the
            transfer message so we can match it to your account.
          </p>
          <a
            href={`mailto:${PAYMENTS_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-900 transition hover:bg-red-500/20 dark:text-red-200"
          >
            <Mail className="h-4 w-4" aria-hidden />
            Email payment to {PAYMENTS_EMAIL}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
