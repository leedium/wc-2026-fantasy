import { resolveTeamSource } from '../knockoutResolver';
import type {
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  R32BracketAssignment,
} from '@/types/tournament';

const groupPredictions: GroupPrediction[] = [
  {
    groupId: 'A',
    positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' },
  },
  {
    groupId: 'B',
    positions: { first: 'sui', second: 'qat', third: 'bih', fourth: 'can' },
  },
];

const matches: KnockoutMatch[] = [
  { id: 'M1', stage: 'round_of_32', team1Source: '1A', team2Source: '2B', pointValue: 2 },
  { id: 'M2', stage: 'round_of_32', team1Source: '1E', team2Source: '3-ABCDF', pointValue: 2 },
  { id: 'M17', stage: 'round_of_16', team1Source: 'M1', team2Source: 'M2', pointValue: 4 },
  { id: 'M29', stage: 'semi_finals', team1Source: 'M25', team2Source: 'M26', pointValue: 15 },
  { id: 'M31', stage: 'third_place', team1Source: 'L-M29', team2Source: 'L-M30', pointValue: 10 },
];

describe('resolveTeamSource', () => {
  it('resolves group-position references', () => {
    expect(resolveTeamSource('1A', matches, groupPredictions, [])).toBe('mex');
    expect(resolveTeamSource('2B', matches, groupPredictions, [])).toBe('qat');
    expect(resolveTeamSource('3A', matches, groupPredictions, [])).toBe('rsa');
  });

  it('returns null for an unknown group', () => {
    expect(resolveTeamSource('1Z', matches, groupPredictions, [])).toBeNull();
  });

  it('resolves match-winner references', () => {
    const knockoutPredictions: KnockoutMatchPrediction[] = [
      { matchId: 'M1', winnerId: 'mex' },
    ];
    expect(resolveTeamSource('M1', matches, groupPredictions, knockoutPredictions)).toBe('mex');
  });

  it('returns null when the predicted winner is missing', () => {
    expect(resolveTeamSource('M1', matches, groupPredictions, [])).toBeNull();
  });

  it('resolves match-loser references via the contestants', () => {
    // M1 contestants: 1A (mex), 2B (qat). Predicted winner: mex → loser: qat.
    const knockoutPredictions: KnockoutMatchPrediction[] = [
      { matchId: 'M1', winnerId: 'mex' },
    ];
    // Build a fake third-place match that consumes L-M1 just to exercise the path.
    const localMatches: KnockoutMatch[] = [
      ...matches,
      {
        id: 'M99',
        stage: 'third_place',
        team1Source: 'L-M1',
        team2Source: 'L-M1',
        pointValue: 10,
      },
    ];
    expect(resolveTeamSource('L-M1', localMatches, groupPredictions, knockoutPredictions)).toBe(
      'qat'
    );
  });

  it('returns null for an unrecognised source', () => {
    expect(resolveTeamSource('garbage', matches, groupPredictions, [])).toBeNull();
  });

  describe('3rd-place R32 slot source', () => {
    // In the v2 model, '3-XXXXX' sources resolve via the admin-set
    // r32_bracket_assignments. The 5-letter token is decorative — the
    // resolver looks up (matchId, slot) tuple that owns the source.
    it('resolves to the admin-assigned team for the slot', () => {
      const assignments: R32BracketAssignment[] = [
        { matchId: 'M2', slot: 2, teamId: 'rsa' },
      ];
      expect(
        resolveTeamSource('3-ABCDF', matches, groupPredictions, [], assignments)
      ).toBe('rsa');
    });

    it('returns null when no bracket assignment is set yet', () => {
      expect(resolveTeamSource('3-ABCDF', matches, groupPredictions, [], [])).toBeNull();
    });

    it('returns null when no match owns the source string', () => {
      const assignments: R32BracketAssignment[] = [
        { matchId: 'M2', slot: 2, teamId: 'rsa' },
      ];
      expect(
        resolveTeamSource('3-XXXXX', matches, groupPredictions, [], assignments)
      ).toBeNull();
    });
  });
});
