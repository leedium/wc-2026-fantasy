# Analytics (Google Tag Manager)

This app loads **Google Tag Manager** via `@next/third-parties` and pushes a small set of
high-value custom events to the GTM `dataLayer`. GA4 (or any other tag) is configured **inside the
GTM web UI** — the app only emits the container script + `dataLayer` events; it does not talk to GA4
directly.

## How it's wired

- **Container script:** `<GoogleTagManager>` is rendered in `src/app/layout.tsx`.
  - Loaded with the `afterInteractive` strategy → does **not** block first paint / Core Web Vitals.
  - Gated on `process.env.NODE_ENV === 'production'` **and** `NEXT_PUBLIC_GTM_ID` being set, so
    local/dev traffic is never tracked.
- **Container ID:** `NEXT_PUBLIC_GTM_ID` (e.g. `GTM-XXXXXXX`). Set it in the deployment environment.
  Empty = GTM fully disabled.
- **Event helper:** `src/lib/analytics.ts` exports `trackEvent(event, params)` and the
  `ANALYTICS_EVENTS` name map. It is a safe no-op on the server and whenever `NEXT_PUBLIC_GTM_ID`
  is unset, so call sites don't guard individually.
- **CSP:** `next.config.ts` allows `googletagmanager.com` (script + frame) and
  `*.google-analytics.com` / `*.analytics.google.com` (connect). Update there if you add more tags.

## Custom events

Pageviews / route changes are captured automatically by GTM — they are **not** in this list.
No event carries PII (no email / username / raw input); only booleans, enums, and opaque ids.

| `event` name           | Fires when…                                              | Params                          | Source file |
|------------------------|---------------------------------------------------------|---------------------------------|-------------|
| `sign_up`              | A new account is created (post-signup, genuine new user)| `has_referral: boolean`         | `src/app/register/RegisterForm.tsx` |
| `login`                | A user signs in successfully                             | —                               | `src/app/login/LoginForm.tsx` |
| `new_prediction`       | "New prediction" is clicked                             | —                               | `src/app/predictions/PredictionsListPage.tsx` |
| `prediction_submitted` | The wizard submit succeeds                              | `mode: 'create' \| 'edit'`      | `src/app/predictions/PredictionsPageContent.tsx` |
| `phase1_saved`         | The Phase 1 "save" action succeeds                     | —                               | `src/app/predictions/PredictionsPageContent.tsx` |
| `free_pick_redeemed`   | A free pick is redeemed                                 | `source: 'referral' \| 'loyalty'` | `src/app/predictions/PredictionsListPage.tsx` |
| `referral_shared`      | A referral code / link is copied or shared             | `method: 'code' \| 'link' \| 'native'` | `src/app/referrals/ReferralsPageContent.tsx` |
| `find_my_rank`         | "Find my rank" is clicked on the leaderboard           | —                               | `src/app/leaderboard/LeaderboardPageContent.tsx` |
| `set_user`             | Auth state changes (incl. initial load)                | `user_id: string \| null` (Supabase UUID) | `src/providers/AuthProvider.tsx` |

## Configuring GA4 in the GTM UI

For each event above, create a **Custom Event trigger** (Event name = the `event` value) and a
**GA4 Event tag** that maps the params to GA4 event parameters. Suggested starting point:

1. **GA4 Configuration tag** — fires on *All Pages* (Initialization) with your GA4 Measurement ID.
   This gives you automatic pageviews from GTM's History Change handling.
2. **One GA4 Event tag per custom event** — Event Name = the `event` value, with Event Parameters
   pulled from `dataLayer` variables (e.g. a `dlv - method` variable for `referral_shared`).
3. For `set_user`, set the GA4 **User ID** field (and/or a `user_id` user property) from the
   `user_id` dataLayer variable to enable cross-session/cross-device stitching.

## Follow-ups (not implemented)

- **Cookie consent / Google Consent Mode v2** — recommended before serving EU traffic. Would add a
  consent banner and default-denied consent signals so analytics respects opt-in. Tracked as a
  separate task.
- The app currently sets `robots: noindex` (pre-launch). Analytics is unaffected; revisit at launch.
