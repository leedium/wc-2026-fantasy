import { pruneOrphanedAdvancers } from '@/lib/advancers';
import type { AdvancerPrediction, GroupPrediction } from '@/types/tournament';

function group(groupId: string, third: string | null): GroupPrediction {
  return {
    groupId,
    positions: { first: 'x', second: 'y', third, fourth: 'z' },
  };
}

const advancers = (ids: string[]): AdvancerPrediction[] =>
  ids.map((teamId, i) => ({ rank: i + 1, teamId }));

describe('pruneOrphanedAdvancers', () => {
  it('keeps advancers whose team is still a 3rd-place pick (same reference)', () => {
    const groups = [group('A', 't1'), group('B', 't2')];
    const input = advancers(['t1', 't2']);
    const result = pruneOrphanedAdvancers(input, groups);
    expect(result.removedCount).toBe(0);
    expect(result.advancers).toBe(input); // unchanged → same ref so callers can skip
  });

  it('drops an advancer whose 3rd-place team was changed away', () => {
    const groups = [group('A', 't1'), group('B', 't9')]; // t2 no longer in 3rd
    const input = advancers(['t1', 't2']);
    const result = pruneOrphanedAdvancers(input, groups);
    expect(result.removedCount).toBe(1);
    expect(result.advancers).toEqual([{ rank: 1, teamId: 't1' }]);
  });

  it('drops all advancers when groups are reset (no 3rd-place picks)', () => {
    const groups = [group('A', null), group('B', null)];
    const input = advancers(['t1', 't2']);
    const result = pruneOrphanedAdvancers(input, groups);
    expect(result.removedCount).toBe(2);
    expect(result.advancers).toEqual([]);
  });

  it('leaves rank gaps for surviving picks rather than recompacting', () => {
    const groups = [group('A', 't1'), group('B', 't9'), group('C', 't3')];
    const input = advancers(['t1', 't2', 't3']); // ranks 1,2,3
    const result = pruneOrphanedAdvancers(input, groups);
    expect(result.advancers).toEqual([
      { rank: 1, teamId: 't1' },
      { rank: 3, teamId: 't3' },
    ]);
  });

  it('handles an empty advancer list', () => {
    const result = pruneOrphanedAdvancers([], [group('A', 't1')]);
    expect(result.removedCount).toBe(0);
    expect(result.advancers).toEqual([]);
  });
});
