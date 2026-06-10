/**
 * Analytics — thin, typed wrapper over Google Tag Manager's dataLayer.
 *
 * GTM itself is loaded once in the root layout (`src/app/layout.tsx`) via
 * `@next/third-parties`. This module is the single place client components push
 * custom events from. It is a safe no-op when GTM is not configured (local dev,
 * or any environment without `NEXT_PUBLIC_GTM_ID`), so call sites don't need to
 * guard each call.
 *
 * Conventions:
 * - Event names are snake_case and live in {@link ANALYTICS_EVENTS}.
 * - Never pass PII (email, username, raw input). Booleans, enums, and opaque
 *   ids only — e.g. `has_referral`, `source`, `prediction_id`.
 *
 * Pageviews / route changes are captured automatically by GTM; only custom
 * interaction events flow through here.
 */
import { sendGTMEvent } from '@next/third-parties/google';

export const ANALYTICS_EVENTS = {
  signUp: 'sign_up',
  login: 'login',
  newPrediction: 'new_prediction',
  predictionSubmitted: 'prediction_submitted',
  phase1Saved: 'phase1_saved',
  freePickRedeemed: 'free_pick_redeemed',
  referralShared: 'referral_shared',
  findMyRank: 'find_my_rank',
  setUser: 'set_user',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Push a custom event to the GTM dataLayer. No-op on the server and when GTM is
 * unconfigured (so dev and unconfigured envs stay silent).
 */
export function trackEvent(event: AnalyticsEvent, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_GTM_ID) return;
  sendGTMEvent({ event, ...params });
}
