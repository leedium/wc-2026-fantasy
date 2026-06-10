import { newDraftHasContent, type NewDraftData } from '../draftSummary';

const emptyGroups: NewDraftData['groupPredictions'] = Array.from({ length: 12 }, () => ({
  positions: { first: null, second: null, third: null, fourth: null },
}));

describe('newDraftHasContent', () => {
  it('is false for null/undefined', () => {
    expect(newDraftHasContent(null)).toBe(false);
    expect(newDraftHasContent(undefined)).toBe(false);
  });

  it('is false for a bare skeleton draft (all-null slots, no name)', () => {
    expect(
      newDraftHasContent({
        predictionName: '   ',
        championTeamId: null,
        totalGoals: null,
        groupPredictions: emptyGroups,
        advancerPredictions: [],
        knockoutPredictions: [{ winnerId: null }],
      })
    ).toBe(false);
  });

  it('is true when a prediction name is entered', () => {
    expect(newDraftHasContent({ predictionName: 'My Bracket' })).toBe(true);
  });

  it('is true when a group slot is filled', () => {
    expect(
      newDraftHasContent({
        groupPredictions: [{ positions: { first: 't1', second: null, third: null, fourth: null } }],
      })
    ).toBe(true);
  });

  it('is true when an advancer is picked', () => {
    expect(newDraftHasContent({ advancerPredictions: [{ rank: 1, teamId: 't1' }] })).toBe(true);
  });

  it('is true when the champion or tiebreaker is set', () => {
    expect(newDraftHasContent({ championTeamId: 't1' })).toBe(true);
    expect(newDraftHasContent({ totalGoals: 12 })).toBe(true);
  });

  it('is true when a knockout winner is picked', () => {
    expect(newDraftHasContent({ knockoutPredictions: [{ winnerId: 't1' }] })).toBe(true);
  });
});
