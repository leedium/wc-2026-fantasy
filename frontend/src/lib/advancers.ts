import type { AdvancerPrediction, GroupPrediction } from '@/types/tournament';

/**
 * Best-3rds advancer picks must be drawn from the prediction's own
 * group-stage 3rd-place picks (the server enforces this in
 * `submit_predictions`). When a group change alters which teams sit in 3rd
 * place, any advancer that pointed at a now-removed 3rd-place team becomes an
 * orphan that the RPC will reject on save — which silently blocks
 * navigation, because step transitions autosave first.
 *
 * `pruneOrphanedAdvancers` drops those orphaned entries (leaving the rank
 * slot empty for the user to re-pick) so client state stays valid. Returns
 * the surviving advancers plus the count removed, or the original array
 * reference when nothing changed (so callers can skip a state update).
 */
export function pruneOrphanedAdvancers(
  advancers: AdvancerPrediction[],
  groupPredictions: GroupPrediction[]
): { advancers: AdvancerPrediction[]; removedCount: number } {
  const validThirds = new Set(
    groupPredictions
      .map((g) => g.positions.third)
      .filter((id): id is string => id !== null)
  );
  const kept = advancers.filter((a) => validThirds.has(a.teamId));
  if (kept.length === advancers.length) {
    return { advancers, removedCount: 0 };
  }
  return { advancers: kept, removedCount: advancers.length - kept.length };
}
