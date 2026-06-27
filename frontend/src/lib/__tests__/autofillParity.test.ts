/**
 * Parity spec for the Phase 2 bracket auto-fill.
 *
 * The authoritative fill lives in SQL (migration 0071,
 * admin_autofill_phase2_brackets). This test encodes the SAME rules in TS,
 * driven by the shared resolver (knockoutResolver.resolveTeamSource), and
 * asserts the key scenarios the SQL must reproduce:
 *   - champion advances along its real path and wins the final
 *   - a user pick that eliminates the champion is honored (champion can't win)
 *   - seed ties fall to the team1 / team1_source side
 *   - third-place (L-M..) resolves to SF losers, not winners
 *   - a group-3rd already placed in a bracket slot is deduped (resolves null)
 *
 * Live SQL↔TS parity is verified manually via `supabase db reset` + seeding
 * (see the plan's verification section); this guards the rule definitions that
 * the SQL is a line-by-line mirror of.
 */
import { resolveTeamSource } from '@/lib/knockoutResolver';
import { fixtureGroups, fixtureKnockoutMatches } from '@/test-utils/fixtures';
import type {
  GroupStanding,
  KnockoutMatchPrediction,
  R32BracketAssignment,
} from '@/types/tournament';

// Real group results: each group's 4 fixture teams in order → 1st/2nd/3rd/4th.
const standings: GroupStanding[] = fixtureGroups.map((g) => ({
  groupId: g.id,
  firstTeamId: g.teams[0].id,
  secondTeamId: g.teams[1].id,
  thirdTeamId: g.teams[2].id,
  fourthTeamId: g.teams[3].id,
}));

function seedOf(teamId: string): number {
  for (const s of standings) {
    if (s.firstTeamId === teamId) return 1;
    if (s.secondTeamId === teamId) return 2;
    if (s.thirdTeamId === teamId) return 3;
    if (s.fourthTeamId === teamId) return 4;
  }
  return 9;
}

/** TS mirror of admin_autofill_phase2_brackets' per-prediction fill loop. */
function autofill(
  championId: string,
  bracketAssignments: R32BracketAssignment[] = [],
  existing: KnockoutMatchPrediction[] = []
): Map<string, string> {
  const winners = new Map<string, string>();
  for (const e of existing) if (e.winnerId) winners.set(e.matchId, e.winnerId);

  for (const m of fixtureKnockoutMatches) {
    if (winners.has(m.id)) continue;
    const preds: KnockoutMatchPrediction[] = Array.from(winners.entries()).map(
      ([matchId, winnerId]) => ({ matchId, winnerId })
    );
    const t1 = resolveTeamSource(
      m.team1Source,
      fixtureKnockoutMatches,
      [],
      preds,
      bracketAssignments,
      standings
    );
    const t2 = resolveTeamSource(
      m.team2Source,
      fixtureKnockoutMatches,
      [],
      preds,
      bracketAssignments,
      standings
    );

    let w: string | null;
    if (t1 == null && t2 == null) continue;
    else if (t1 == null) w = t2;
    else if (t2 == null) w = t1;
    else if (t1 === championId) w = t1;
    else if (t2 === championId) w = t2;
    else if (seedOf(t1) <= seedOf(t2)) w = t1; // tie → team1 side
    else w = t2;

    if (w) winners.set(m.id, w);
  }
  return winners;
}

describe('Phase 2 bracket auto-fill (parity spec)', () => {
  it('fills all 32 matches from an empty bracket', () => {
    const winners = autofill('arg');
    expect(winners.size).toBe(fixtureKnockoutMatches.length);
    for (const m of fixtureKnockoutMatches) {
      expect(winners.get(m.id)).toBeTruthy();
    }
  });

  it('advances the champion along its real path and wins the final', () => {
    // arg = Group J winner (1J) → M83 → M93 → M98 → M101 → M104.
    const winners = autofill('arg');
    expect(winners.get('M83')).toBe('arg');
    expect(winners.get('M101')).toBe('arg');
    expect(winners.get('M104')).toBe('arg');
  });

  it('honors a user pick that eliminates the champion', () => {
    // User already picked 2I (sen) to beat arg in M83; champion can't advance.
    const existing: KnockoutMatchPrediction[] = [{ matchId: 'M83', winnerId: 'sen' }];
    const winners = autofill('arg', [], existing);
    expect(winners.get('M83')).toBe('sen'); // user pick preserved
    expect(winners.get('M104')).not.toBe('arg');
  });

  it('breaks a seed tie in favor of the team1 / team1_source side', () => {
    // M89 = winner(M74)=bra(seed1) vs winner(M77)=fra(seed1); neither is champion.
    const winners = autofill('arg');
    expect(winners.get('M89')).toBe('bra');
  });

  it('resolves the third-place match from semifinal losers', () => {
    const winners = autofill('arg');
    const third = winners.get('M103');
    expect(third).toBeTruthy();
    // The 3rd-place winner is one of the SF losers, never an SF winner.
    expect(third).not.toBe(winners.get('M101'));
    expect(third).not.toBe(winners.get('M102'));
  });

  it('dedupes a group-3rd that is already placed in a bracket slot', () => {
    // rsa = Group A 3rd. Placing it in any bracket slot makes the plain '3A'
    // source resolve to null (it materializes via its assigned slot instead).
    const assignments: R32BracketAssignment[] = [
      { matchId: 'M85', slot: 1, teamId: 'rsa' },
    ];
    const resolved = resolveTeamSource(
      '3A',
      fixtureKnockoutMatches,
      [],
      [],
      assignments,
      standings
    );
    expect(resolved).toBeNull();
  });
});
