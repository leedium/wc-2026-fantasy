/**
 * Shared rank-badge styling for the leaderboard standings and the prize tables,
 * so both surfaces colour 1st–5th identically. 1st–3rd are the classic
 * gold/silver/bronze; 4th/5th get distinct cool tones since they only win in
 * Phase 2. Returns null for ranks with no prize/badge.
 */
export interface RankBadge {
  color: string;
  label: string;
}

export function getRankBadge(rank: number): RankBadge | null {
  switch (rank) {
    case 1:
      return { color: 'bg-yellow-500 text-yellow-950', label: '1st' };
    case 2:
      return { color: 'bg-gray-400 dark:bg-gray-300 text-gray-950', label: '2nd' };
    case 3:
      return { color: 'bg-amber-600 text-amber-950', label: '3rd' };
    case 4:
      return { color: 'bg-sky-500 text-sky-950', label: '4th' };
    case 5:
      return { color: 'bg-violet-500 text-violet-950', label: '5th' };
    default:
      return null;
  }
}
