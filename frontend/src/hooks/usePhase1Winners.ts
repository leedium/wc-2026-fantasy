'use client';

import { useQuery } from '@tanstack/react-query';
import type { Phase1Winner } from '@/types/tournament';

export const PHASE1_WINNERS_QUERY_KEY = ['phase1-winners'] as const;

interface Phase1WinnersResponse {
  winners: Phase1Winner[];
}

/**
 * Public read of the frozen Phase 1 top 3 (group + advancer), backed by
 * `/api/leaderboard/phase1-winners`. Empty until an admin snapshots the
 * standings; the admin snapshot button invalidates the ['phase1-winners'] key.
 */
export function usePhase1Winners() {
  const query = useQuery<Phase1WinnersResponse>({
    queryKey: PHASE1_WINNERS_QUERY_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/leaderboard/phase1-winners', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load Phase 1 winners');
      return res.json();
    },
  });

  return {
    winners: query.data?.winners ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
