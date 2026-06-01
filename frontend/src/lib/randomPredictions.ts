// Random "feeling lucky" pick generators. These mirror the return shapes of the
// FIFA-ranking auto-fill helpers in @/lib/fifaRankings, but shuffle instead of
// sort. Kept in a separate module because randomization is not ranking-related.

import { ADVANCER_COUNT } from '@/lib/constants';
import type { AdvancerPrediction, Group, GroupPrediction, Team } from '@/types/tournament';

// Fisher–Yates shuffle. `rng` is injectable so tests can be deterministic.
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomizeGroupPredictions(
  groups: Group[],
  rng: () => number = Math.random,
): GroupPrediction[] {
  return groups.map((group) => {
    const shuffled = shuffle(group.teams, rng);
    return {
      groupId: group.id,
      positions: {
        first: shuffled[0]?.id ?? null,
        second: shuffled[1]?.id ?? null,
        third: shuffled[2]?.id ?? null,
        fourth: shuffled[3]?.id ?? null,
      },
    };
  });
}

export function randomizeAdvancers(
  candidatePool: Team[],
  rng: () => number = Math.random,
): AdvancerPrediction[] {
  return shuffle(candidatePool, rng)
    .slice(0, ADVANCER_COUNT)
    .map((team, i) => ({ rank: i + 1, teamId: team.id }));
}
