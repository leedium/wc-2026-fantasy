import { cascadeKnockoutPick } from '../knockoutCascade';
import { fixtureKnockoutMatches } from '@/test-utils/fixtures';
import type { GroupPrediction, KnockoutMatchPrediction } from '@/types/tournament';

// Group predictions covering the groups feeding the chain under test.
//   M73 = 1A vs 2B  -> mex vs sui
//   M75 = 1E vs 2F  -> ger vs jpn
// The winner of M73 advances to M90 (slot 1), which feeds M97 (slot 2),
// which feeds M101 (slot 1), which feeds M104 (slot 1) — a full R32 -> Final chain.
const groupPredictions: GroupPrediction[] = [
  { groupId: 'A', positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' } },
  { groupId: 'B', positions: { first: 'can', second: 'sui', third: 'qat', fourth: 'bih' } },
  { groupId: 'C', positions: { first: 'bra', second: 'mar', third: 'sco', fourth: 'hai' } },
  { groupId: 'D', positions: { first: 'usa', second: 'par', third: 'aus', fourth: 'tur' } },
  { groupId: 'E', positions: { first: 'ger', second: 'ecu', third: 'civ', fourth: 'cuw' } },
  { groupId: 'F', positions: { first: 'ned', second: 'jpn', third: 'tun', fourth: 'swe' } },
];

/** All matches present, every winner null — mirrors `buildEmptyKnockout`. */
function emptyPredictions(): KnockoutMatchPrediction[] {
  return fixtureKnockoutMatches.map((m) => ({ matchId: m.id, winnerId: null }));
}

function withWinners(
  overrides: Record<string, string | null>
): KnockoutMatchPrediction[] {
  return emptyPredictions().map((p) =>
    p.matchId in overrides ? { ...p, winnerId: overrides[p.matchId] } : p
  );
}

function winnerOf(predictions: KnockoutMatchPrediction[], matchId: string): string | null {
  return predictions.find((p) => p.matchId === matchId)?.winnerId ?? null;
}

function run(
  changedMatchId: string,
  newWinnerId: string | null,
  predictions: KnockoutMatchPrediction[]
) {
  return cascadeKnockoutPick(
    changedMatchId,
    newWinnerId,
    fixtureKnockoutMatches,
    predictions,
    groupPredictions
  );
}

describe('cascadeKnockoutPick', () => {
  it('carries the swapped team through every later round it was picked to win', () => {
    // mex (1A) picked to win all the way to the Final.
    const predictions = withWinners({
      M73: 'mex',
      M75: 'ger',
      M90: 'mex',
      M97: 'mex',
      M101: 'mex',
      M104: 'mex',
    });

    // Swap M73 to the other contestant (sui = 2B).
    const { predictions: next, changedMatchIds } = run('M73', 'sui', predictions);

    expect(winnerOf(next, 'M73')).toBe('sui');
    expect(winnerOf(next, 'M90')).toBe('sui');
    expect(winnerOf(next, 'M97')).toBe('sui');
    expect(winnerOf(next, 'M101')).toBe('sui');
    expect(winnerOf(next, 'M104')).toBe('sui');
    expect(changedMatchIds.sort()).toEqual(['M101', 'M104', 'M90', 'M97'].sort());
  });

  it('leaves picks on the unaffected side untouched', () => {
    // In M90 the user picked ger (the M75 side), not the M73 winner.
    const predictions = withWinners({
      M73: 'mex',
      M75: 'ger',
      M90: 'ger',
      M97: 'ger',
      M101: 'ger',
      M104: 'ger',
    });

    const { predictions: next, changedMatchIds } = run('M73', 'sui', predictions);

    // The ger branch is downstream of M75, not M73 — nothing should move.
    expect(winnerOf(next, 'M73')).toBe('sui');
    expect(winnerOf(next, 'M90')).toBe('ger');
    expect(winnerOf(next, 'M97')).toBe('ger');
    expect(winnerOf(next, 'M101')).toBe('ger');
    expect(winnerOf(next, 'M104')).toBe('ger');
    expect(changedMatchIds).toEqual([]);
  });

  it('clears the downstream chain when the upstream pick is deselected', () => {
    const predictions = withWinners({
      M73: 'mex',
      M75: 'ger',
      M90: 'mex',
      M97: 'mex',
      M101: 'mex',
      M104: 'mex',
    });

    const { predictions: next, changedMatchIds } = run('M73', null, predictions);

    expect(winnerOf(next, 'M73')).toBeNull();
    expect(winnerOf(next, 'M90')).toBeNull();
    expect(winnerOf(next, 'M97')).toBeNull();
    expect(winnerOf(next, 'M101')).toBeNull();
    expect(winnerOf(next, 'M104')).toBeNull();
    expect(changedMatchIds.sort()).toEqual(['M101', 'M104', 'M90', 'M97'].sort());
  });

  it('reports no downstream changes when nothing later was picked', () => {
    const predictions = withWinners({ M73: 'mex' });

    const { predictions: next, changedMatchIds } = run('M73', 'sui', predictions);

    expect(winnerOf(next, 'M73')).toBe('sui');
    expect(changedMatchIds).toEqual([]);
  });

  it('swaps the loser through the third-place match and the winner through the final', () => {
    // Semi-finals resolved directly via stored match-winner sources.
    //   M101 = M97 vs M98 -> mex vs bra,  winner mex (loser bra)
    //   M102 = M99 vs M100 -> fra vs arg, winner fra (loser arg)
    //   M103 = L-M101 vs L-M102 -> bra vs arg, user picks bra (loser of M101)
    //   M104 = M101 vs M102 -> mex vs fra, winner mex
    const predictions = withWinners({
      M97: 'mex',
      M98: 'bra',
      M99: 'fra',
      M100: 'arg',
      M101: 'mex',
      M102: 'fra',
      M103: 'bra',
      M104: 'mex',
    });

    // Flip the M101 winner to the other contestant.
    const { predictions: next, changedMatchIds } = run('M101', 'bra', predictions);

    // The loser of M101 is now mex, and the user's "loser-of-M101" pick follows it.
    expect(winnerOf(next, 'M103')).toBe('mex');
    // The final pick that backed the M101 winner follows it too.
    expect(winnerOf(next, 'M104')).toBe('bra');
    expect(changedMatchIds.sort()).toEqual(['M103', 'M104'].sort());
  });

  it('leaves picks on unrelated branches alone — including stale ones masked as complete', () => {
    // M74 (R32) feeds M89; M90 lives on a different branch (M73/M75) that only
    // rejoins M74's at M97. M90 carries a STALE pick ('arg' — not one of its
    // M73/M75 contestants), the kind of masked-complete pick a bracket can hold
    // after earlier edits. Changing M74 must not disturb M90.
    const predictions = withWinners({
      M73: 'mex',
      M75: 'ger',
      M90: 'arg', // stale: M90 is mex vs ger, never arg
      M74: 'bra', // 1C
      M89: 'bra', // valid on M74's side
    });

    // Swap M74 to its other contestant (2D = par).
    const { predictions: next, changedMatchIds } = run('M74', 'par', predictions);

    // The unrelated stale pick is untouched...
    expect(winnerOf(next, 'M90')).toBe('arg');
    expect(changedMatchIds).not.toContain('M90');
    // ...while M74's own downstream pick is carried forward.
    expect(winnerOf(next, 'M89')).toBe('par');
    expect(changedMatchIds).toContain('M89');
  });

  it('does not proactively clear a stale pick on the changed branch', () => {
    // M97 carries a stale pick ('arg') that sits on neither of its contestants.
    // Changing M73 carries M90 (mex -> sui) but must leave the stale M97 pick
    // for the existing MatchCard auto-clear rather than nulling it here.
    const predictions = withWinners({
      M73: 'mex',
      M75: 'ger',
      M90: 'mex', // valid, on M73's side
      M97: 'arg', // stale: M97 is (M89 winner) vs (M90 winner), never arg
    });

    const { predictions: next, changedMatchIds } = run('M73', 'sui', predictions);

    expect(winnerOf(next, 'M90')).toBe('sui'); // carried
    expect(winnerOf(next, 'M97')).toBe('arg'); // stale pick left as-is
    expect(changedMatchIds).not.toContain('M97');
  });
});
