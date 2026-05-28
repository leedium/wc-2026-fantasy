import { resolveTeamSource } from '../knockoutResolver';
import type {
  GroupPrediction,
  GroupStanding,
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
  { id: 'M73', stage: 'round_of_32', team1Source: '1A', team2Source: '2B', pointValue: 2 },
  { id: 'M74', stage: 'round_of_32', team1Source: '1E', team2Source: '3-ABCDF', pointValue: 2 },
  { id: 'M89', stage: 'round_of_16', team1Source: 'M73', team2Source: 'M74', pointValue: 4 },
  { id: 'M101', stage: 'semi_finals', team1Source: 'M97', team2Source: 'M98', pointValue: 15 },
  { id: 'M103', stage: 'third_place', team1Source: 'L-M101', team2Source: 'L-M102', pointValue: 10 },
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
      { matchId: 'M73', winnerId: 'mex' },
    ];
    expect(resolveTeamSource('M73', matches, groupPredictions, knockoutPredictions)).toBe('mex');
  });

  it('returns null when the predicted winner is missing', () => {
    expect(resolveTeamSource('M73', matches, groupPredictions, [])).toBeNull();
  });

  it('resolves match-loser references via the contestants', () => {
    // M73 contestants: 1A (mex), 2B (qat). Predicted winner: mex → loser: qat.
    const knockoutPredictions: KnockoutMatchPrediction[] = [
      { matchId: 'M73', winnerId: 'mex' },
    ];
    // Build a fake third-place match that consumes L-M73 just to exercise the path.
    const localMatches: KnockoutMatch[] = [
      ...matches,
      {
        id: 'M999',
        stage: 'third_place',
        team1Source: 'L-M73',
        team2Source: 'L-M73',
        pointValue: 10,
      },
    ];
    expect(resolveTeamSource('L-M73', localMatches, groupPredictions, knockoutPredictions)).toBe(
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
        { matchId: 'M74', slot: 2, teamId: 'rsa' },
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
        { matchId: 'M74', slot: 2, teamId: 'rsa' },
      ];
      expect(
        resolveTeamSource('3-XXXXX', matches, groupPredictions, [], assignments)
      ).toBeNull();
    });
  });

  describe('admin bracket authoritative-override for top-2 predictions', () => {
    // When the admin places a team in an R32 3rd-place slot, that team really
    // finished 3rd in its group, so any user prediction putting that team in a
    // top-2 slot is falsified by reality. Resolver must return null for the
    // user-predicted slot so the team renders once (in the admin slot) instead
    // of duplicating across matches.
    it('suppresses a user-predicted 1A when the team is also in bracketAssignments', () => {
      // User predicted 'mex' as 1st of A; admin placed 'mex' in the (M74, 2) 3-XXXXX slot.
      const assignments: R32BracketAssignment[] = [
        { matchId: 'M74', slot: 2, teamId: 'mex' },
      ];
      expect(
        resolveTeamSource('1A', matches, groupPredictions, [], assignments)
      ).toBeNull();
      // And the admin slot still resolves correctly to the same team.
      expect(
        resolveTeamSource('3-ABCDF', matches, groupPredictions, [], assignments)
      ).toBe('mex');
    });

    it('suppresses a user-predicted 2B when the team is also in bracketAssignments', () => {
      // Mirrors the reported bug: user has 'qat' as 2nd of B; admin placed
      // 'qat' in the (M74, 2) 3-XXXXX slot.
      const assignments: R32BracketAssignment[] = [
        { matchId: 'M74', slot: 2, teamId: 'qat' },
      ];
      expect(
        resolveTeamSource('2B', matches, groupPredictions, [], assignments)
      ).toBeNull();
    });

    it('suppresses a user-predicted 3A when the team is also in bracketAssignments', () => {
      // Consistency check: if a 3X source ever points to a team admin has
      // already placed, the explicit admin slot wins and the 3X slot is null.
      const assignments: R32BracketAssignment[] = [
        { matchId: 'M74', slot: 2, teamId: 'rsa' },
      ];
      expect(
        resolveTeamSource('3A', matches, groupPredictions, [], assignments)
      ).toBeNull();
    });

    it('does not suppress when there is no overlap', () => {
      // 'kor' is user's 2nd of A. Admin's bracket has a different team. No conflict.
      const assignments: R32BracketAssignment[] = [
        { matchId: 'M74', slot: 2, teamId: 'rsa' },
      ];
      expect(
        resolveTeamSource('1A', matches, groupPredictions, [], assignments)
      ).toBe('mex');
      expect(
        resolveTeamSource('2B', matches, groupPredictions, [], assignments)
      ).toBe('qat');
    });

    it('does not suppress when bracketAssignments is empty (Phase 1)', () => {
      expect(resolveTeamSource('1A', matches, groupPredictions, [], [])).toBe('mex');
      expect(resolveTeamSource('2B', matches, groupPredictions, [], [])).toBe('qat');
      expect(resolveTeamSource('3A', matches, groupPredictions, [], [])).toBe('rsa');
    });
  });

  describe('Phase 2 path: groupStandings overrides groupPredictions', () => {
    // Once the admin enters real group standings, the resolver should use those
    // for "1A" / "2A" / "3A" sources — not the user's Phase 1 guesses. This is
    // the bracket-decoupling change in scoring v4 (migration 0052).
    const adminStandings: GroupStanding[] = [
      {
        groupId: 'A',
        firstTeamId: 'rsa', // user predicted mex, actual rsa
        secondTeamId: 'cze',
        thirdTeamId: 'kor',
        fourthTeamId: 'mex',
      },
      {
        groupId: 'B',
        firstTeamId: 'can',
        secondTeamId: 'bih',
        thirdTeamId: 'sui',
        fourthTeamId: 'qat',
      },
    ];

    it('uses admin standings when present (Phase 2)', () => {
      expect(
        resolveTeamSource('1A', matches, groupPredictions, [], [], adminStandings)
      ).toBe('rsa');
      expect(
        resolveTeamSource('2A', matches, groupPredictions, [], [], adminStandings)
      ).toBe('cze');
      expect(
        resolveTeamSource('3B', matches, groupPredictions, [], [], adminStandings)
      ).toBe('sui');
    });

    it('falls back to user picks when no standings for that group', () => {
      // Standings only cover A + B; group C source falls back to user predictions
      // (or null if user has none).
      expect(
        resolveTeamSource('1C', matches, groupPredictions, [], [], adminStandings)
      ).toBeNull();
    });

    it('still respects admin-bracket override after standings lookup', () => {
      // Admin standings put rsa as 1A. If admin then placed rsa in a 3-XXXXX
      // bracket slot too, the 1A slot must collapse to TBD to avoid dupes.
      const assignments: R32BracketAssignment[] = [
        { matchId: 'M74', slot: 2, teamId: 'rsa' },
      ];
      expect(
        resolveTeamSource('1A', matches, groupPredictions, [], assignments, adminStandings)
      ).toBeNull();
      expect(
        resolveTeamSource('3-ABCDF', matches, groupPredictions, [], assignments, adminStandings)
      ).toBe('rsa');
    });
  });
});
