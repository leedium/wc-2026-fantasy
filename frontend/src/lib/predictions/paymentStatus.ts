import { ADVANCER_COUNT, TOURNAMENT_CONFIG } from '@/lib/constants';

/**
 * Minimal shape needed to decide whether a prediction needs a payment nudge.
 * Mirrors the relevant fields of the `/api/predictions` GET response.
 */
export interface PaymentStatusInput {
  isPaid: boolean;
  submittedAt: string | null;
  groups?: ReadonlyArray<unknown>;
  advancers?: ReadonlyArray<unknown>;
  championTeamId?: string | null;
}

/**
 * Mirrors the DB `prediction_phase1_complete`: a complete Phase 1 pick set is
 * all 12 group rows + 8 advancer rows. During Phase 1 these "Save Phase 1
 * Picks" rows have `submitted_at = null` (they read as "Draft" in the UI) but
 * are already leaderboard-eligible once paid.
 */
export function isPhase1Complete(p: PaymentStatusInput): boolean {
  return (
    (p.groups?.length ?? 0) === TOURNAMENT_CONFIG.totalGroups &&
    (p.advancers?.length ?? 0) === ADVANCER_COUNT
  );
}

/**
 * True when *all* Phase 1 stages are filled: groups + advancers (per
 * {@link isPhase1Complete}) **plus** the gut-feeling champion pick. Distinct
 * from `isPhase1Complete`, which omits the champion to mirror the DB
 * `prediction_phase1_complete` leaderboard-eligibility filter. Used to drive
 * the "Phase 1 Complete" badge so a fully-finished-but-not-yet-submitted entry
 * no longer reads as "Draft" — matching the wizard's own completeness check
 * (`isChampionPickComplete && isGroupsComplete && isAdvancersComplete`).
 */
export function isPhase1StagesComplete(p: PaymentStatusInput): boolean {
  return isPhase1Complete(p) && p.championTeamId != null;
}

/**
 * True when a prediction would appear on the leaderboard if it were paid —
 * i.e. it is unpaid AND either explicitly submitted OR has a complete Phase 1
 * pick set. This is the exact frontend mirror of the eligibility filter in
 * `get_leaderboard` (`submitted_at is not null OR prediction_phase1_complete`),
 * so the unpaid payment notice + row tint cover Phase 1 saved drafts too.
 *
 * Genuinely-incomplete drafts (still mid-creation) are excluded: even if paid
 * they wouldn't rank, so there's nothing to nudge yet.
 */
export function needsPayment(p: PaymentStatusInput): boolean {
  return !p.isPaid && (p.submittedAt != null || isPhase1Complete(p));
}
