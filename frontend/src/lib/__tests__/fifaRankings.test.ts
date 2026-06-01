import type { Group, Team } from '@/types/tournament';

import {
  FIFA_RANKINGS,
  autofillAdvancersByFifaRanking,
  autofillGroupPredictionsByFifaRanking,
} from '../fifaRankings';

const makeGroup = (id: string, teams: Array<{ id: string; code: string }>): Group => ({
  id,
  name: `Group ${id}`,
  teams: teams.map((t) => ({ id: t.id, name: t.id, code: t.code, group: id })),
});

const makeTeam = (id: string, code: string): Team => ({ id, name: id, code, group: 'X' });

describe('autofillGroupPredictionsByFifaRanking', () => {
  it('orders top-3 by rank ascending, with leftover team in 4th', () => {
    const rankings = { AAA: 1, BBB: 2, CCC: 3, DDD: 4 };
    const group = makeGroup('A', [
      { id: 'd', code: 'DDD' },
      { id: 'b', code: 'BBB' },
      { id: 'a', code: 'AAA' },
      { id: 'c', code: 'CCC' },
    ]);

    const [pred] = autofillGroupPredictionsByFifaRanking([group], rankings);

    expect(pred.groupId).toBe('A');
    expect(pred.positions.first).toBe('a');
    expect(pred.positions.second).toBe('b');
    expect(pred.positions.third).toBe('c');
    expect(pred.positions.fourth).toBe('d');
  });

  it('sorts teams missing from the rankings to the bottom', () => {
    const rankings = { AAA: 5, BBB: 10 };
    const group = makeGroup('A', [
      { id: 'unknown1', code: 'XXX' },
      { id: 'a', code: 'AAA' },
      { id: 'unknown2', code: 'YYY' },
      { id: 'b', code: 'BBB' },
    ]);

    const [pred] = autofillGroupPredictionsByFifaRanking([group], rankings);

    expect(pred.positions.first).toBe('a');
    expect(pred.positions.second).toBe('b');
    expect([pred.positions.third, pred.positions.fourth].sort()).toEqual(
      ['unknown1', 'unknown2'].sort(),
    );
  });

  it('fills all four positions for every group with no null slots', () => {
    const groups: Group[] = ['A', 'B', 'C'].map((g) =>
      makeGroup(g, [
        { id: `${g}-1`, code: `${g}A` },
        { id: `${g}-2`, code: `${g}B` },
        { id: `${g}-3`, code: `${g}C` },
        { id: `${g}-4`, code: `${g}D` },
      ]),
    );

    const result = autofillGroupPredictionsByFifaRanking(groups, {});

    expect(result).toHaveLength(3);
    for (const pred of result) {
      const slots = Object.values(pred.positions);
      expect(slots.every((v) => v !== null)).toBe(true);
      expect(new Set(slots).size).toBe(4);
    }
  });

  it('uses FIFA_RANKINGS by default and produces sensible top-of-group picks', () => {
    const group = makeGroup('H', [
      { id: 'esp', code: 'ESP' },
      { id: 'uru', code: 'URU' },
      { id: 'ksa', code: 'KSA' },
      { id: 'cpv', code: 'CPV' },
    ]);

    const [pred] = autofillGroupPredictionsByFifaRanking([group]);

    expect(pred.positions.first).toBe('esp');
    expect(pred.positions.second).toBe('uru');
    expect(FIFA_RANKINGS.ESP).toBeLessThan(FIFA_RANKINGS.URU);
  });
});

describe('autofillAdvancersByFifaRanking', () => {
  it('orders the pool by rank ascending and assigns ranks 1..8', () => {
    const rankings = { AAA: 1, BBB: 2, CCC: 3 };
    const pool = [makeTeam('c', 'CCC'), makeTeam('a', 'AAA'), makeTeam('b', 'BBB')];

    const result = autofillAdvancersByFifaRanking(pool, rankings);

    expect(result).toEqual([
      { rank: 1, teamId: 'a' },
      { rank: 2, teamId: 'b' },
      { rank: 3, teamId: 'c' },
    ]);
  });

  it('caps the result at the 8 best-ranked teams', () => {
    const rankings = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`T${i}`, i + 1]),
    );
    const pool = Array.from({ length: 12 }, (_, i) => makeTeam(`t${i}`, `T${i}`));

    // Shuffle-ish: reverse so input order does not match rank order.
    const result = autofillAdvancersByFifaRanking([...pool].reverse(), rankings);

    expect(result).toHaveLength(8);
    expect(result.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.map((p) => p.teamId)).toEqual([
      't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7',
    ]);
  });

  it('sorts teams missing from the rankings to the bottom', () => {
    const rankings = { AAA: 5, BBB: 10 };
    const pool = [
      makeTeam('unknown1', 'XXX'),
      makeTeam('a', 'AAA'),
      makeTeam('b', 'BBB'),
    ];

    const result = autofillAdvancersByFifaRanking(pool, rankings);

    expect(result.map((p) => p.teamId)).toEqual(['a', 'b', 'unknown1']);
  });

  it('fills only what is available when the pool has fewer than 8 teams', () => {
    const rankings = { AAA: 1, BBB: 2 };
    const pool = [makeTeam('a', 'AAA'), makeTeam('b', 'BBB')];

    const result = autofillAdvancersByFifaRanking(pool, rankings);

    expect(result).toEqual([
      { rank: 1, teamId: 'a' },
      { rank: 2, teamId: 'b' },
    ]);
  });
});
