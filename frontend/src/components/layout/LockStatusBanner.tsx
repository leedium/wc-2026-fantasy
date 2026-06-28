'use client';

import { useEffect } from 'react';
import { AlertCircle, Lock, Unlock } from 'lucide-react';

import { useTournamentLock } from '@/hooks/useTournamentLock';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatRemaining } from '@/lib/formatRemaining';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function LockStatusBanner() {
  const {
    lockTime,
    isLoading,
    phase,
    remainingMs,
    hasActiveDeadline,
    clockSuspect,
    knockoutLockTime,
  } = useTournamentLock();
  const { profile } = useAuth();

  // One-time cleanup: the dismiss control was removed (see below), but devices
  // that dismissed under the old scheme still carry a sticky sessionStorage flag
  // — on iOS Safari the session can persist for days. Sweep any leftover
  // `banner-dismissed:*` keys on load so those users recover immediately.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith('wc2026:banner-dismissed:')) {
          window.sessionStorage.removeItem(key);
        }
      }
    } catch {
      // best-effort
    }
  }, []);

  // The banner is a time-critical deadline reminder, so it is always shown (no
  // dismiss control). A previous sessionStorage-backed ✕ could permanently bury
  // the countdown on iOS Safari, where the session survives tab restore /
  // backgrounding for days.
  if (isLoading || !lockTime) return null;

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
      </div>
    </div>
  );
}
