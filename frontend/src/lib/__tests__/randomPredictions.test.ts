import type { Group, Team } from '@/types/tournament';

import { randomizeAdvancers, randomizeGroupPredictions } from '../randomPredictions';

const makeGroup = (id: string, teamIds: string[]): Group => ({
  id,
  name: `Group ${id}`,
  teams: teamIds.map((tid) => ({ id: tid, name: tid, code: tid.toUpperCase(), group: id })),
});

const makeTeam = (id: string): Team => ({ id, name: id, code: id.toUpperCase(), group: 'X' });

// Deterministic rng: cycles through a fixed sequence of values in [0, 1).
const seqRng = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('randomizeGroupPredictions', () => {
  it('fills all four positions with a permutation of the group teams', () => {
    const groups = ['A', 'B', 'C'].map((g) =>
      makeGroup(g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`]),
    );

    const result = randomizeGroupPredictions(groups, seqRng([0.1, 0.9, 0.4, 0.7]));

    expect(result).toHaveLength(3);
    for (const pred of result) {
      const group = groups.find((g) => g.id === pred.groupId)!;
      const slots = Object.values(pred.positions);
      expect(slots.every((v) => v !== null)).toBe(true);
      expect(new Set(slots).size).toBe(4);
      expect(new Set(slots)).toEqual(new Set(group.teams.map((t) => t.id)));
    }
  });

  it('produces a deterministic ordering for a fixed rng', () => {
    const group = makeGroup('A', ['a', 'b', 'c', 'd']);
    const rngA = seqRng([0.0, 0.0, 0.0]);
    const rngB = seqRng([0.0, 0.0, 0.0]);

    const [first] = randomizeGroupPredictions([group], rngA);
    const [second] = randomizeGroupPredictions([group], rngB);

    expect(first.positions).toEqual(second.positions);
  });
});

describe('randomizeAdvancers', () => {
  it('returns 8 distinct picks ranked 1..8 drawn from the pool', () => {
    const pool = Array.from({ length: 12 }, (_, i) => makeTeam(`t${i}`));

    const result = randomizeAdvancers(pool, seqRng([0.3, 0.6, 0.1, 0.8, 0.5]));

    expect(result).toHaveLength(8);
    expect(result.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const teamIds = result.map((p) => p.teamId);
    expect(new Set(teamIds).size).toBe(8);
    const poolIds = new Set(pool.map((t) => t.id));
    expect(teamIds.every((id) => poolIds.has(id))).toBe(true);
  });

  it('fills only what is available when the pool has fewer than 8 teams', () => {
    const pool = [makeTeam('a'), makeTeam('b'), makeTeam('c')];

    const result = randomizeAdvancers(pool, seqRng([0.5, 0.2]));

    expect(result).toHaveLength(3);
    expect(result.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(new Set(result.map((p) => p.teamId))).toEqual(new Set(['a', 'b', 'c']));
  });
});
