'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

type Phase = 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';

interface KnockoutLock {
  matchId: string;
  lockedAt: string;
}

interface TournamentResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  lockTime: string;
  knockoutLockTime: string | null;
  knockoutUnlocked: boolean;
  phase: Phase;
  totalEntries: number;
  knockoutLocks?: KnockoutLock[];
  serverTime: string;
}

export interface TournamentLockState {
  tournamentId: string | null;
  lockTime: Date | null;
  knockoutLockTime: Date | null;
  knockoutUnlocked: boolean;
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
  /**
   * True when the current phase has a real future deadline we can count
   * down to. False when phase 2 is open but no lock time has been set —
   * in that case `remainingMs` is 0 but the UI should not render
   * "0m left" because there is no deadline at all.
   */
  hasActiveDeadline: boolean;
  /** True if |skewMs| > 5 minutes — surface a hint to the user. */
  clockSuspect: boolean;
  /**
   * True when a specific knockout fixture has individually locked (its kickoff
   * has passed), evaluated against server time. Independent of the global phase
   * lock — a fixture can lock while phase 2 is still open.
   */
  /** Ids of fixtures currently locked — handy for the cascade's immovable set. */
  lockedMatchIds: Set<string>;
  /**
   * Per-fixture lock state for the wizard card:
   *   - no lock scheduled → `{ locked: false, remainingMs: null }`
   *   - lock in the future → `{ locked: false, remainingMs: > 0 }` (countdown)
   *   - lock passed → `{ locked: true, remainingMs: 0 }`
   * Evaluated against server time; recomputed every second.
   */
  getMatchLockInfo: (matchId: string) => { locked: boolean; remainingMs: number | null };
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
  const hasActiveDeadline = activeDeadline !== null;
  const clockSuspect = Math.abs(skewMs) > FIVE_MINUTES_MS;

  // Map of fixture id -> lock time (ms). Rebuilt only when the lock list changes.
  const lockMsByMatch = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const lock of data?.knockoutLocks ?? []) {
      m.set(lock.matchId, new Date(lock.lockedAt).getTime());
    }
    return m;
  }, [data?.knockoutLocks]);

  // Set of fixtures whose lock time has passed, against server time (Date.now()
  // + skew). Depends on `tick` so a fixture flips to locked the moment its
  // kickoff passes, without a refetch.
  const lockedMatchIds = React.useMemo(() => {
    const ids = new Set<string>();
    const nowServer = Date.now() + skewMs;
    for (const [matchId, lockedMs] of lockMsByMatch) {
      if (nowServer >= lockedMs) ids.add(matchId);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockMsByMatch, skewMs, tick]);

  const getMatchLockInfo = React.useCallback(
    (matchId: string): { locked: boolean; remainingMs: number | null } => {
      const lockedMs = lockMsByMatch.get(matchId);
      if (lockedMs === undefined) return { locked: false, remainingMs: null };
      const remaining = lockedMs - (Date.now() + skewMs);
      return remaining <= 0
        ? { locked: true, remainingMs: 0 }
        : { locked: false, remainingMs: remaining };
    },
    // `tick` drives a fresh function each second so the card countdown re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lockMsByMatch, skewMs, tick]
  );

  return {
    tournamentId: data?.id ?? null,
    lockTime,
    knockoutLockTime,
    knockoutUnlocked,
    phase,
    isLoading: query.isLoading,
    skewMs,
    isLocked,
    isPhase1Open,
    isPhase2Open,
    remainingMs,
    hasActiveDeadline,
    clockSuspect,
    lockedMatchIds,
    getMatchLockInfo,
  };
}
