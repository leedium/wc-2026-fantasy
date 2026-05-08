/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { useTournamentLock } from '../useTournamentLock';

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
});

describe('useTournamentLock', () => {
  it('reports unlocked with a positive remaining ms when lock is in the future', async () => {
    const lockTime = new Date(Date.now() + 60_000).toISOString();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 't1',
        slug: 'wc',
        name: 'WC',
        status: 'upcoming',
        lockTime,
        totalEntries: 0,
        serverTime: new Date().toISOString(),
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTournamentLock(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.tournamentId).toBe('t1'));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.remainingMs).toBeGreaterThan(0);
    expect(result.current.clockSuspect).toBe(false);
  });

  it('reports locked when server time is past lockTime even if local clock disagrees', async () => {
    const lockTime = new Date('2026-01-01T00:00:00Z').toISOString();
    // Pretend the server clock is one hour past the lock; local clock thinks it's
    // way before. The hook should still report locked.
    const serverTime = new Date('2026-01-01T01:00:00Z').toISOString();

    // Force Date.now() to return something well before lockTime.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-01T00:00:00Z'));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 't1',
        slug: 'wc',
        name: 'WC',
        status: 'group_stage',
        lockTime,
        totalEntries: 0,
        serverTime,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTournamentLock(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.tournamentId).toBe('t1'));
    expect(result.current.isLocked).toBe(true);
    expect(result.current.remainingMs).toBe(0);
    // Skew is ~7 months → definitely suspect.
    expect(result.current.clockSuspect).toBe(true);
  });

  it('flags clockSuspect when |skew| > 5 minutes', async () => {
    const lockTime = new Date(Date.now() + 86_400_000).toISOString();
    const serverTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 't1',
        slug: 'wc',
        name: 'WC',
        status: 'upcoming',
        lockTime,
        totalEntries: 0,
        serverTime,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTournamentLock(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.clockSuspect).toBe(true));
  });

  it('ticks the countdown', async () => {
    const lockTime = new Date(Date.now() + 5_000).toISOString();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 't1',
        slug: 'wc',
        name: 'WC',
        status: 'upcoming',
        lockTime,
        totalEntries: 0,
        serverTime: new Date().toISOString(),
      }),
    }) as unknown as typeof fetch;

    jest.useFakeTimers();
    const { result } = renderHook(() => useTournamentLock(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.tournamentId).toBe('t1'));

    const initial = result.current.remainingMs;
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.remainingMs).toBeLessThanOrEqual(initial);
  });
});
