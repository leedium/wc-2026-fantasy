import type {
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
} from '@/types/tournament';

/**
 * Resolves a `team1_source` / `team2_source` reference (e.g. `"1A"`, `"M5"`,
 * `"L-M29"`) to the predicted team id, given a user's group + knockout picks.
 * Returns null when the picks for the source aren't filled in yet.
 */
export function resolveTeamSource(
  source: string,
  matches: KnockoutMatch[],
  groupPredictions: GroupPrediction[],
  knockoutPredictions: KnockoutMatchPrediction[]
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
      knockoutPredictions
    );
    const team2Id = resolveTeamSource(
      match.team2Source,
      matches,
      groupPredictions,
      knockoutPredictions
    );

    if (matchPrediction.winnerId === team1Id) return team2Id;
    if (matchPrediction.winnerId === team2Id) return team1Id;
    return null;
  }

  return null;
}
