import type {
  GroupPrediction,
  KnockoutMatch,
  KnockoutMatchPrediction,
  R32BracketAssignment,
} from '@/types/tournament';

/**
 * Resolves a `team1_source` / `team2_source` reference (e.g. `"1A"`, `"M5"`,
 * `"L-M29"`, `"3-ABCDF"`) to the predicted team id, given the user's group +
 * knockout picks and the admin-set R32 bracket assignments. Returns null
 * when the picks (or admin assignment) for the source aren't filled in yet.
 */
export function resolveTeamSource(
  source: string,
  matches: KnockoutMatch[],
  groupPredictions: GroupPrediction[],
  knockoutPredictions: KnockoutMatchPrediction[],
  bracketAssignments: R32BracketAssignment[] = []
): string | null {
  // Group position source: '1A' = 1st in Group A, '2B' = 2nd in Group B, etc.
  const groupMatch = source.match(/^([123])([A-L])$/);
  if (groupMatch) {
    const [, position, groupId] = groupMatch;
    const groupPrediction = groupPredictions.find((p) => p.groupId === groupId);
    if (!groupPrediction) return null;
    let resolved: string | null;
    switch (position) {
      case '1':
        resolved = groupPrediction.positions.first;
        break;
      case '2':
        resolved = groupPrediction.positions.second;
        break;
      case '3':
        resolved = groupPrediction.positions.third;
        break;
      default:
        return null;
    }
    // Admin's bracket assignments are tournament truth. If the user-predicted
    // team for this slot is already placed by the admin in a 3-XXXXX R32 slot,
    // that team really finished 3rd in its group and cannot also be its actual
    // 1st/2nd. Suppress here so the team renders once (in the admin slot) and
    // this slot shows as TBD instead of duplicating.
    if (resolved && bracketAssignments.some((a) => a.teamId === resolved)) {
      return null;
    }
    return resolved;
  }

  // Best-3rd-of-bundle source: '3-ABCDF' etc. In the new model these strings
  // are decorative — FIFA decides which advancer fills each slot. The admin
  // records the assignment in r32_bracket_assignments and we look it up by
  // the (matchId, slot) tuple that owns this source string.
  if (/^3-[A-L]{5}$/.test(source)) {
    const match = matches.find(
      (m) => m.team1Source === source || m.team2Source === source
    );
    if (!match) return null;
    const slot: 1 | 2 = match.team1Source === source ? 1 : 2;
    const assignment = bracketAssignments.find(
      (a) => a.matchId === match.id && a.slot === slot
    );
    return assignment?.teamId ?? null;
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
      bracketAssignments
    );
    const team2Id = resolveTeamSource(
      match.team2Source,
      matches,
      groupPredictions,
      knockoutPredictions,
      bracketAssignments
    );

    if (matchPrediction.winnerId === team1Id) return team2Id;
    if (matchPrediction.winnerId === team2Id) return team1Id;
    return null;
  }

  return null;
}
