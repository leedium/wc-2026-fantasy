'use client';

import * as React from 'react';
import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';

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
 * Payment is an Interac e-transfer sent from the user's own bank — NOT an email
 * — so the address is shown as plain text (no `mailto:`), with a short
 * how-to-pay instruction instead of a misleading "email" button.
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
            ). Send an{' '}
            <span className="inline-flex items-center gap-1 font-semibold">
              Interac
              <Image
                src="/interac-logo.png"
                alt=""
                aria-hidden
                width={20}
                height={20}
                className="inline-block h-auto w-[20px] align-middle"
              />
            </span>{' '}
            e-transfer to{' '}
            <span className="font-semibold break-all">{PAYMENTS_EMAIL}</span>. You{' '}
            <span className="font-semibold uppercase">must</span> put your registered
            email{' '}
            <span className="inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 font-mono text-xs font-semibold break-all text-white dark:bg-red-500">
              {emailLabel}
            </span>{' '}
            in the Interac message so we can match the payment to your account —
            without it your entries can&apos;t be credited.
          </p>
          <p className="text-sm">
            <span className="font-semibold">How to pay:</span> log in to your online
            banking or banking app, choose <span className="font-medium">Interac
            e-Transfer</span>, and send to{' '}
            <span className="font-semibold break-all">{PAYMENTS_EMAIL}</span>. This
            isn&apos;t an email — the transfer is sent through your bank.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
