import type { Group } from '@/types/tournament';

import { FIFA_RANKINGS, autofillGroupPredictionsByFifaRanking } from '../fifaRankings';

const makeGroup = (id: string, teams: Array<{ id: string; code: string }>): Group => ({
  id,
  name: `Group ${id}`,
  teams: teams.map((t) => ({ id: t.id, name: t.id, code: t.code, group: id })),
});

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
