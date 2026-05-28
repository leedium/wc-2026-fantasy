import type {
  GroupPrediction,
  GroupStanding,
  KnockoutMatch,
  KnockoutMatchPrediction,
  R32BracketAssignment,
} from '@/types/tournament';

/**
 * Resolves a `team1_source` / `team2_source` reference (e.g. `"1A"`, `"M77"`,
 * `"L-M101"`, `"3-ABCDF"`) to the predicted team id.
 *
 * Group-position sources resolve from `groupStandings` (admin's actual top-4)
 * when present — this is the Phase 2 path, where the bracket reflects what
 * really happened, not what the user predicted in Phase 1. When standings are
 * absent (Phase 1 preview), the resolver falls back to the user's own
 * `groupPredictions` so the bracket still renders something meaningful while
 * the group stage is unfinished.
 *
 * Returns null when the source can't yet be resolved.
 */
export function resolveTeamSource(
  source: string,
  matches: KnockoutMatch[],
  groupPredictions: GroupPrediction[],
  knockoutPredictions: KnockoutMatchPrediction[],
  bracketAssignments: R32BracketAssignment[] = [],
  groupStandings: GroupStanding[] = []
): string | null {
  // Group position source: '1A' = 1st in Group A, '2B' = 2nd in Group B, etc.
  const groupMatch = source.match(/^([123])([A-L])$/);
  if (groupMatch) {
    const [, position, groupId] = groupMatch;
    const standing = groupStandings.find((s) => s.groupId === groupId);
    let resolved: string | null = null;
    if (standing) {
      // Phase 2 path: prefer admin-entered standings as the source of truth.
      switch (position) {
        case '1':
          resolved = standing.firstTeamId;
          break;
        case '2':
          resolved = standing.secondTeamId;
          break;
        case '3':
          resolved = standing.thirdTeamId;
          break;
        default:
          return null;
      }
    } else {
      // Phase 1 preview path: fall back to the user's group prediction.
      const groupPrediction = groupPredictions.find((p) => p.groupId === groupId);
      if (!groupPrediction) return null;
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
    }
    // Admin's bracket assignments are tournament truth. If the team resolved
    // for this slot is already placed by the admin in a 3-XXXXX R32 slot,
    // suppress here so the team renders once (in the admin slot) and this
    // slot shows as TBD instead of duplicating.
    if (resolved && bracketAssignments.some((a) => a.teamId === resolved)) {
      return null;
    }
    return resolved;
  }

  // Best-3rd-of-bundle source: '3-ABCDF' etc. The admin records each slot's
  // actual advancer in r32_bracket_assignments — look it up by the
  // (matchId, slot) tuple that owns this source string.
  if (/^3-[A-L]+$/.test(source)) {
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

  // Match winner source: 'M73' = the predicted winner of match 73.
  if (/^M\d+$/.test(source)) {
    const matchPrediction = knockoutPredictions.find((p) => p.matchId === source);
    return matchPrediction?.winnerId ?? null;
  }

  // Match loser source: 'L-M101' = the loser of M101 (the team that lost in
  // the user's prediction). Recurse to figure out who the two contestants were.
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
      bracketAssignments,
      groupStandings
    );
    const team2Id = resolveTeamSource(
      match.team2Source,
      matches,
      groupPredictions,
      knockoutPredictions,
      bracketAssignments,
      groupStandings
    );

    if (matchPrediction.winnerId === team1Id) return team2Id;
    if (matchPrediction.winnerId === team2Id) return team1Id;
    return null;
  }

  return null;
}
