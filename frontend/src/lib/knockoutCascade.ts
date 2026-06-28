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
 *
 * Only the changed match's own bracket subtree is touched, and only picks that
 * sat on a slot fed by the changed chain are moved. Matches on unrelated
 * branches — and picks that were already stale (sitting on neither resolved
 * slot) — are left exactly as they were, so changing one match never disturbs
 * another branch or surfaces a pre-existing invalid pick.
 */

/** True when `source` feeds from `matchId` — directly (`M101`) or as its loser (`L-M101`). */
function referencesMatch(source: string, matchId: string): boolean {
  return source === matchId || source === `L-${matchId}`;
}
export function cascadeKnockoutPick(
  changedMatchId: string,
  newWinnerId: string | null,
  matches: KnockoutMatch[],
  predictions: KnockoutMatchPrediction[],
  groupPredictions: GroupPrediction[],
  bracketAssignments: R32BracketAssignment[] = [],
  groupStandings: GroupStanding[] = [],
  /**
   * Ids of fixtures that have individually locked (kicked off). A locked pick is
   * frozen server-side, so the cascade must treat it as immovable: never rewrite
   * a locked downstream match when an upstream winner changes.
   */
  lockedMatchIds: Set<string> = new Set()
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

  // Collect the changed match's bracket subtree: every match that transitively
  // feeds from it. Unrelated branches are never considered, so their picks
  // (including pre-existing stale ones masked as "complete") stay untouched.
  const subtree = new Set<string>();
  const queue = [changedMatchId];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    for (const m of matches) {
      if (subtree.has(m.id)) continue;
      if (referencesMatch(m.team1Source, parent) || referencesMatch(m.team2Source, parent)) {
        subtree.add(m.id);
        queue.push(m.id);
      }
    }
  }

  // Process the subtree in topological order so each match's upstream winners
  // are already finalized in `next` by the time we reach it.
  const downstream = matches
    .filter((m) => subtree.has(m.id))
    .sort((a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage]);

  const changedMatchIds: string[] = [];
  for (const m of downstream) {
    if (lockedMatchIds.has(m.id)) continue; // locked (kicked off) — frozen, never rewrite
    const oldWinner = winnerOf(m.id);
    if (oldWinner === null) continue; // nothing picked here — leave it

    const slots = before.get(m.id)!;
    // Only move a pick that sat on a slot fed by the changed chain. A pick on
    // neither resolved slot was already stale — leave it for the existing
    // MatchCard auto-clear so we never surface invalidity the user hadn't seen.
    let slotSource: string;
    if (oldWinner === slots.slot1) {
      slotSource = m.team1Source; // keep the slot-1 side
    } else if (oldWinner === slots.slot2) {
      slotSource = m.team2Source; // keep the slot-2 side
    } else {
      continue; // already stale / on neither tracked slot — leave as-is
    }

    // Swap to the new team for that slot (or null if the upstream pick was cleared).
    const replacement = resolveTeamSource(
      slotSource,
      matches,
      groupPredictions,
      next,
      bracketAssignments,
      groupStandings
    );

    if (replacement !== oldWinner) {
      setWinner(m.id, replacement);
      changedMatchIds.push(m.id);
    }
  }

  return { predictions: next, changedMatchIds };
}
