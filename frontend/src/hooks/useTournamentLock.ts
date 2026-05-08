'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

interface TournamentResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  lockTime: string;
  totalEntries: number;
  serverTime: string;
}

export interface TournamentLockState {
  tournamentId: string | null;
  lockTime: Date | null;
  isLoading: boolean;
  /** Server-time minus client-time, in ms. 0 if data not loaded. */
  skewMs: number;
  /** True iff `Date.now() + skewMs >= lockTime`. */
  isLocked: boolean;
  /** Milliseconds remaining until lock (clamped at 0). */
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

  // Tick once per second so the countdown updates.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!lockTime) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [lockTime]);

  const remainingMs = React.useMemo(() => {
    if (!lockTime) return 0;
    return Math.max(0, lockTime.getTime() - (Date.now() + skewMs));
    // tick included so this re-evaluates each second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockTime, skewMs, tick]);

  const isLocked = remainingMs === 0 && !!lockTime;
  const clockSuspect = Math.abs(skewMs) > FIVE_MINUTES_MS;

  return {
    tournamentId: data?.id ?? null,
    lockTime,
    isLoading: query.isLoading,
    skewMs,
    isLocked,
    remainingMs,
    clockSuspect,
  };
}
