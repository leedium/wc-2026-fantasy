'use client';

import * as React from 'react';
import { AlertCircle, Lock, Unlock, X } from 'lucide-react';

import { useTournamentLock } from '@/hooks/useTournamentLock';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function dismissKey(tournamentId: string, phase: string): string {
  return `wc2026:banner-dismissed:${tournamentId}:${phase}`;
}

export function LockStatusBanner() {
  const {
    tournamentId,
    lockTime,
    isLoading,
    phase,
    remainingMs,
    hasActiveDeadline,
    clockSuspect,
    knockoutLockTime,
  } = useTournamentLock();
  const { profile } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);

  // Re-evaluate dismissal state when the tournament or phase change so
  // a state transition re-shows the banner.
  React.useEffect(() => {
    if (!tournamentId || typeof window === 'undefined') {
      setDismissed(false);
      return;
    }
    try {
      const flag = window.sessionStorage.getItem(dismissKey(tournamentId, phase));
      setDismissed(flag === '1');
    } catch {
      setDismissed(false);
    }
  }, [tournamentId, phase]);

  const handleDismiss = React.useCallback(() => {
    if (!tournamentId || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(dismissKey(tournamentId, phase), '1');
    } catch {
      // best-effort
    }
    setDismissed(true);
  }, [tournamentId, phase]);

  if (isLoading || !lockTime || dismissed) return null;

  const isSuperAdmin = profile?.isSuperAdmin === true;
  const urgent =
    (phase === 'phase1' || phase === 'phase2_open') && remainingMs <= ONE_DAY_MS;

  // The knockout stage has begun once Phase 2 was opened (a knockout lock
  // time was set) and is no longer accepting writes. `knockout_lock_time` is
  // only ever written by opening Phase 2 and is never cleared on close, so a
  // non-null value during phase1_locked means the admin opened then closed
  // Phase 2 (or hasn't reopened it). Entering best-3rd advancers no longer
  // factors in — it's a scoring input that can be filled mid-group-stage.
  const knockoutLocked =
    phase === 'phase2_locked' ||
    (phase === 'phase1_locked' && knockoutLockTime !== null);

  // Tone + icon per phase.
  let tone: 'open' | 'urgent' | 'between' | 'locked' = 'open';
  if (knockoutLocked) tone = 'locked';
  else if (phase === 'phase1_locked') tone = 'between';
  else if (urgent) tone = 'urgent';

  const toneClasses = {
    open: 'bg-green-600 text-white',
    urgent: 'bg-amber-600 text-white',
    between: 'bg-slate-600 text-white',
    locked: 'bg-red-600 text-white',
  } as const;

  const Icon = phase === 'phase1' || phase === 'phase2_open' ? Unlock : Lock;

  return (
    <div
      role="status"
      className={cn('w-full border-b border-black/10 shadow-sm', toneClasses[tone])}
    >
      <div className="mx-auto flex max-w-7xl items-start justify-center gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium">
            {phase === 'phase1' &&
              `You have ${formatRemaining(remainingMs)} left to choose your group + best-3rd picks before the tournament starts! Don't miss out!`}
            {phase === 'phase1_locked' && !knockoutLocked &&
              'Group stage in progress. Knockout predictions will open once the knockout bracket is determined.'}
            {phase === 'phase2_open' && hasActiveDeadline &&
              `You have ${formatRemaining(remainingMs)} left to make your knockout picks!`}
            {phase === 'phase2_open' && !hasActiveDeadline &&
              'Knockout predictions are open. The admin has not set a Phase 2 lock time yet.'}
            {knockoutLocked &&
              'The knockout stage has begun. Predictions are locked.'}
          </span>
          {(phase === 'phase1_locked' || phase === 'phase2_locked') && isSuperAdmin && (
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium">
              Super admin: edits still open
            </span>
          )}
          {clockSuspect && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs">
              <AlertCircle className="h-3 w-3" aria-hidden />
              Your device clock looks off — countdown shown is server time.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="-mr-1 inline-flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
