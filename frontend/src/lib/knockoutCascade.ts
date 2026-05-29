import type {
  GroupPrediction,
  GroupStanding,
  KnockoutMatch,
  KnockoutMatchPrediction,
  KnockoutStage,
  R32BracketAssignment,
} from '@/types/tournament';
import { resolveTeamSource } from './knockoutResolver';

/**
 * Topological rank of each knockout stage. A match never depends on another
 * match in the same stage, and `third_place` / `final` both depend only on the
 * semi-finals — so any rank strictly greater than `semi_finals` works for both.
 */
const STAGE_RANK: Record<KnockoutStage, number> = {
  round_of_32: 0,
  round_of_16: 1,
  quarter_finals: 2,
  semi_finals: 3,
  third_place: 4,
  final: 4,
};

export interface CascadeResult {
  /** The full predictions array with the change + downstream swaps applied. */
  predictions: KnockoutMatchPrediction[];
  /** Ids of downstream matches whose winner was auto-updated (excludes the originating match). */
  changedMatchIds: string[];
}

/**
 * Apply a knockout winner change and carry the user's selection downstream.
 *
 * Each match has two contestant slots resolved from `team1Source` /
 * `team2Source`. A stored `winnerId` is really a *side* choice ("the team
 * coming out of this slot keeps advancing"). When an upstream winner changes,
 * we preserve the side the user picked in every downstream match and let the
 * team for that slot update — so the new team is carried through the whole
 * chain it was previously picked to win, while picks on the other side (where
 * the old team was already eliminated in the user's bracket) stay put.
 *
 * Deselecting (null) clears downstream picks that depended on the removed team.
 * The third-place match (`L-M101` / `L-M102` loser sources) is handled the same
 * way — preserving the "loser-of-M101 side" yields the correct swap when a
 * semi-final flips.
 */
export function cascadeKnockoutPick(
  changedMatchId: string,
  newWinnerId: string | null,
  matches: KnockoutMatch[],
  predictions: KnockoutMatchPrediction[],
  groupPredictions: GroupPrediction[],
  bracketAssignments: R32BracketAssignment[] = [],
  groupStandings: GroupStanding[] = []
): CascadeResult {
  // Snapshot each match's two contestants from the *current* predictions, so we
  // know which side every existing winner pick sat on before the change.
  const before = new Map<string, { slot1: string | null; slot2: string | null }>();
  for (const m of matches) {
    before.set(m.id, {
      slot1: resolveTeamSource(
        m.team1Source,
        matches,
        groupPredictions,
        predictions,
        bracketAssignments,
        groupStandings
      ),
      slot2: resolveTeamSource(
        m.team2Source,
        matches,
        groupPredictions,
        predictions,
        bracketAssignments,
        groupStandings
      ),
    });
  }

  // Working copy with the user's change applied.
  const next = predictions.map((p) =>
    p.matchId === changedMatchId ? { ...p, winnerId: newWinnerId } : p
  );
  const winnerOf = (id: string) => next.find((p) => p.matchId === id)?.winnerId ?? null;
  const setWinner = (id: string, winnerId: string | null) => {
    const i = next.findIndex((p) => p.matchId === id);
    if (i >= 0) next[i] = { ...next[i], winnerId };
  };

  const changedMatch = matches.find((m) => m.id === changedMatchId);
  if (!changedMatch) return { predictions: next, changedMatchIds: [] };
  const fromRank = STAGE_RANK[changedMatch.stage];

  // Walk strictly-downstream matches in topological order. By the time we reach
  // a match, all of its upstream winners are already finalized in `next`.
  const downstream = matches
    .filter((m) => STAGE_RANK[m.stage] > fromRank)
    .sort((a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage]);

  const changedMatchIds: string[] = [];
  for (const m of downstream) {
    const oldWinner = winnerOf(m.id);
    if (oldWinner === null) continue; // nothing picked here — leave it

    const slots = before.get(m.id)!;
    const after1 = resolveTeamSource(
      m.team1Source,
      matches,
      groupPredictions,
      next,
      bracketAssignments,
      groupStandings
    );
    const after2 = resolveTeamSource(
      m.team2Source,
      matches,
      groupPredictions,
      next,
      bracketAssignments,
      groupStandings
    );

    let replacement: string | null;
    if (oldWinner === slots.slot1) {
      replacement = after1; // keep the slot-1 side, swap to its new team
    } else if (oldWinner === slots.slot2) {
      replacement = after2; // keep the slot-2 side
    } else if (oldWinner === after1 || oldWinner === after2) {
      replacement = oldWinner; // still a valid contestant — untouched
    } else {
      replacement = null; // orphaned — clear (matches existing auto-clear behavior)
    }

    if (replacement !== oldWinner) {
      setWinner(m.id, replacement);
      changedMatchIds.push(m.id);
    }
  }

  return { predictions: next, changedMatchIds };
}
