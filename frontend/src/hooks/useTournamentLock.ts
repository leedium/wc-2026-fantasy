'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

type Phase = 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';

interface TournamentResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  lockTime: string;
  knockoutLockTime: string | null;
  knockoutUnlocked: boolean;
  advancersSet: boolean;
  phase: Phase;
  totalEntries: number;
  serverTime: string;
}

export interface TournamentLockState {
  tournamentId: string | null;
  lockTime: Date | null;
  knockoutLockTime: Date | null;
  knockoutUnlocked: boolean;
  /** True when all 8 ranked 3rd-place advancers have been set by the admin. */
  advancersSet: boolean;
  phase: Phase;
  isLoading: boolean;
  /** Server-time minus client-time, in ms. 0 if data not loaded. */
  skewMs: number;
  /**
   * True when *any* lock is currently active for the user-side wizard:
   * `phase1_locked` (waiting for admin to open phase 2) or `phase2_locked`.
   */
  isLocked: boolean;
  /** True iff phase 1 is currently accepting writes (groups + advancers). */
  isPhase1Open: boolean;
  /** True iff phase 2 is currently accepting writes (knockout + tiebreaker). */
  isPhase2Open: boolean;
  /** Milliseconds remaining until the active phase locks (clamped at 0). */
  remainingMs: number;
  /** True if |skewMs| > 5 minutes — surface a hint to the user. */
  clockSuspect: boolean;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useTournamentLock(): TournamentLockState {
  const query = useQuery<TournamentResponse>({
    queryKey: ['tournament'],
    queryFn: async () => {
      const res = await fetch('/api/tournament');
      if (!res.ok) throw new Error('Failed to fetch tournament');
      return res.json();
    },
  });

  const data = query.data;

  // Compute skew once per data arrival; don't recompute on every render.
  const skewMs = React.useMemo(() => {
    if (!data?.serverTime) return 0;
    return new Date(data.serverTime).getTime() - Date.now();
  }, [data?.serverTime]);

  const lockTime = React.useMemo(
    () => (data?.lockTime ? new Date(data.lockTime) : null),
    [data?.lockTime]
  );
  const knockoutLockTime = React.useMemo(
    () => (data?.knockoutLockTime ? new Date(data.knockoutLockTime) : null),
    [data?.knockoutLockTime]
  );

  // Tick once per second so the countdown updates.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!lockTime) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [lockTime]);

  const phase: Phase = data?.phase ?? 'phase1';
  const knockoutUnlocked = data?.knockoutUnlocked ?? false;
  const advancersSet = data?.advancersSet ?? false;

  // The relevant deadline for "remainingMs" depends on phase:
  //   phase1 → lockTime
  //   phase2_open → knockoutLockTime (may be null = no second deadline yet)
  //   locked phases → 0
  const activeDeadline =
    phase === 'phase1' ? lockTime : phase === 'phase2_open' ? knockoutLockTime : null;

  const remainingMs = React.useMemo(() => {
    if (!activeDeadline) return 0;
    return Math.max(0, activeDeadline.getTime() - (Date.now() + skewMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeadline, skewMs, tick]);

  const isPhase1Open = phase === 'phase1';
  const isPhase2Open = phase === 'phase2_open';
  const isLocked = phase === 'phase1_locked' || phase === 'phase2_locked';
  const clockSuspect = Math.abs(skewMs) > FIVE_MINUTES_MS;

  return {
    tournamentId: data?.id ?? null,
    lockTime,
    knockoutLockTime,
    knockoutUnlocked,
    advancersSet,
    phase,
    isLoading: query.isLoading,
    skewMs,
    isLocked,
    isPhase1Open,
    isPhase2Open,
    remainingMs,
    clockSuspect,
  };
}
