import { USERNAME_REGEX, SCORING, TOURNAMENT_CONFIG, ROUTES } from '../constants';

describe('USERNAME_REGEX', () => {
  it.each([
    ['alice', true],
    ['alice_99', true],
    ['A1_B2_C3', true],
    ['ab', false],
    ['a'.repeat(25), false],
    ['has space', false],
    ['with-dash', false],
    ['with.dot', false],
    ['', false],
    ['emoji🙂', false],
  ])('matches %s => %s', (value, expected) => {
    expect(USERNAME_REGEX.test(value)).toBe(expected);
  });
});

describe('SCORING / TOURNAMENT_CONFIG', () => {
  it('max total points = group + bundle + knockout', () => {
    expect(
      SCORING.maxGroupPoints + SCORING.maxBundlePoints + SCORING.maxKnockoutPoints
    ).toBe(SCORING.maxTotalPoints);
  });

  it('tournament config matches the 48/12/4 structure', () => {
    expect(TOURNAMENT_CONFIG.totalTeams).toBe(48);
    expect(TOURNAMENT_CONFIG.totalGroups).toBe(12);
    expect(TOURNAMENT_CONFIG.teamsPerGroup).toBe(4);
  });

  it('ROUTES does not include claims', () => {
    expect('claims' in ROUTES).toBe(false);
  });
});
