import { BUNDLE_SLOTS } from '@/lib/constants';
import type {
  BundlePrediction,
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
} from '@/types/tournament';

/**
 * Resolves a `team1_source` / `team2_source` reference (e.g. `"1A"`, `"M5"`,
 * `"L-M29"`, `"3-ABCDF"`) to the predicted team id, given a user's group +
 * bundle + knockout picks. Returns null when the picks for the source
 * aren't filled in yet.
 */
export function resolveTeamSource(
  source: string,
  matches: KnockoutMatch[],
  groupPredictions: GroupPrediction[],
  knockoutPredictions: KnockoutMatchPrediction[],
  bundlePredictions: BundlePrediction[] = []
): string | null {
  // Group position source: '1A' = 1st in Group A, '2B' = 2nd in Group B, etc.
  const groupMatch = source.match(/^([123])([A-L])$/);
  if (groupMatch) {
    const [, position, groupId] = groupMatch;
    const groupPrediction = groupPredictions.find((p) => p.groupId === groupId);
    if (!groupPrediction) return null;
    switch (position) {
      case '1':
        return groupPrediction.positions.first;
      case '2':
        return groupPrediction.positions.second;
      case '3':
        return groupPrediction.positions.third;
      default:
        return null;
    }
  }

  // Best-3rd-of-bundle source: '3-ABCDF' = whichever group's 3rd-place team
  // the user predicted to advance from the 5-group bundle.
  const bundleMatch = source.match(/^3-([A-L]{5})$/);
  if (bundleMatch) {
    const bundleKey = bundleMatch[1];
    const slot = BUNDLE_SLOTS.find((s) => s.bundleKey === bundleKey);
    if (!slot) return null;
    const pick = bundlePredictions.find((b) => b.slotIndex === slot.slotIndex);
    if (!pick?.groupLetter) return null;
    const groupPrediction = groupPredictions.find((p) => p.groupId === pick.groupLetter);
    return groupPrediction?.positions.third ?? null;
  }

  // Match winner source: 'M1' = the predicted winner of M1.
  if (/^M\d+$/.test(source)) {
    const matchPrediction = knockoutPredictions.find((p) => p.matchId === source);
    return matchPrediction?.winnerId ?? null;
  }

  // Match loser source: 'L-M29' = the loser of M29 (the team that lost in the
  // user's prediction). Recurse to figure out who the two contestants were.
  const loserMatch = source.match(/^L-M(\d+)$/);
  if (loserMatch) {
    const matchId = `M${loserMatch[1]}`;
    const matchPrediction = knockoutPredictions.find((p) => p.matchId === matchId);
    const match = matches.find((m) => m.id === matchId);
    if (!matchPrediction?.winnerId || !match) return null;

    const team1Id = resolveTeamSource(
      match.team1Source,
      matches,
      groupPredictions,
      knockoutPredictions,
      bundlePredictions
    );
    const team2Id = resolveTeamSource(
      match.team2Source,
      matches,
      groupPredictions,
      knockoutPredictions,
      bundlePredictions
    );

    if (matchPrediction.winnerId === team1Id) return team2Id;
    if (matchPrediction.winnerId === team2Id) return team1Id;
    return null;
  }

  return null;
}
