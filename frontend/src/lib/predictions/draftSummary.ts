/**
 * A new prediction lives only in `localStorage` (under the `:new` slot) until
 * its first successful server save, which is gated on the champion pick — the
 * last Phase 1 step. So a user who enters groups/best-3rds and navigates away
 * leaves an uncommitted draft that never reached the DB and so never appears in
 * the predictions list. The list page reads that `:new` slot to offer a
 * "Resume unsaved draft" affordance.
 *
 * This shape is a deliberately loose, defensive mirror of the wizard's
 * `DraftData` (untrusted localStorage JSON), so we don't pull the whole wizard
 * module into the list page bundle just to read it.
 */
export interface NewDraftData {
  predictionName?: string;
  championTeamId?: string | null;
  totalGoals?: number | null;
  groupPredictions?: Array<{
    positions?: {
      first?: string | null;
      second?: string | null;
      third?: string | null;
      fourth?: string | null;
    };
  }>;
  advancerPredictions?: ReadonlyArray<unknown>;
  knockoutPredictions?: Array<{ winnerId?: string | null }>;
}

/**
 * True when a `:new` draft holds anything worth resuming — any named entry,
 * champion pick, tiebreaker, advancer, group slot, or knockout winner. A bare
 * skeleton draft (all-null slots, written the moment the wizard mounts) returns
 * false so we don't surface a "resume" card for work the user never started.
 */
export function newDraftHasContent(data: NewDraftData | null | undefined): boolean {
  if (!data) return false;
  if (data.predictionName?.trim()) return true;
  if (data.championTeamId) return true;
  if (data.totalGoals != null) return true;
  if ((data.advancerPredictions?.length ?? 0) > 0) return true;
  if (
    data.groupPredictions?.some(
      (g) =>
        g.positions?.first ||
        g.positions?.second ||
        g.positions?.third ||
        g.positions?.fourth
    )
  )
    return true;
  if (data.knockoutPredictions?.some((k) => k.winnerId)) return true;
  return false;
}
