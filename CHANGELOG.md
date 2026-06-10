# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-06-09

### Changed

- Broadcast email now sends via a new `send-broadcast` **Supabase Edge Function** (Deno) instead of
  from the Cloudflare Worker. The Worker can't open raw sockets or bundle a socket SMTP client —
  `worker-mailer` hit unresolvable OpenNext/workerd build + runtime failures (unresolved
  `cloudflare:sockets` → unsupported `require` → unregistered external module). Deno speaks SMTP
  natively, so the send moved there; the Worker calls it over HTTPS gated by a shared secret. The
  function uses a small native SMTP client (plain / implicit-TLS / STARTTLS + AUTH LOGIN), verified
  end-to-end against local Mailpit. Removes `worker-mailer`, `nodemailer`, and the OpenNext/
  worker-mailer `patch-package` patches. **Deploy note:** SMTP_* config moves from Worker secrets to
  the function's secrets (`supabase secrets set ...`); the Worker now needs `BROADCAST_SHARED_SECRET`,
  and the function must be deployed (`supabase functions deploy send-broadcast`). (#221)

## [1.4.0] - 2026-06-10

### Added

- Admin broadcast email: a **"Specific user"** recipient option to address a single user. Selecting
  it reveals a searchable user picker (search by name/email, debounced, backed by `/api/admin/users`);
  the chosen user's email is the sole recipient. The send route validates the address (admin-gated).

### Changed

- Admin broadcast recipient selection is now a **radio group** (one option per line) instead of a row
  of toggle buttons, and includes the new "Specific user" choice. Adds `@radix-ui/react-radio-group`
  and a shadcn `RadioGroup` component. (#223)

## [1.3.0] - 2026-06-10

### Added

- Admin broadcast email: two more recipient segments alongside **All users** and **Paid** —
  **No prediction** (users with no prediction in the active tournament) and **Prediction, unpaid**
  (users with a prediction but no payment). The four segments partition the user base, so admins can
  target non-participants and unpaid participants directly. Migration `0064` adds an
  `admin_list_recipient_emails(p_segment text)` overload (`all|paid|unpaid|no_prediction`); the
  recipients/send API and the Messages UI switch from a boolean `paidOnly` to the `segment` selector.
  (#222)

## [1.2.0] - 2026-06-10

### Changed

- Broadcast email now sends via a new `send-broadcast` **Supabase Edge Function** (Deno) instead of
  from the Cloudflare Worker. The Worker can't open raw sockets or bundle a socket SMTP client —
  `worker-mailer` hit unresolvable OpenNext/workerd build + runtime failures (unresolved
  `cloudflare:sockets` → unsupported `require` → unregistered external module). Deno speaks SMTP
  natively, so the send moved there; the Worker calls it over HTTPS gated by a shared secret. The
  function uses a small native SMTP client (plain / implicit-TLS / STARTTLS + AUTH LOGIN), verified
  end-to-end against local Mailpit. Removes `worker-mailer`, `nodemailer`, and the OpenNext/
  worker-mailer `patch-package` patches. **Deploy note:** SMTP_* config moves from Worker secrets to
  the function's secrets (`supabase secrets set ...`); the Worker now needs `BROADCAST_SHARED_SECRET`,
  and the function must be deployed (`supabase functions deploy send-broadcast`). (#221)

## [1.1.4] - 2026-06-09

### Fixed

- Admin broadcast email send still 500'd in production (`No such module
  "worker-mailer-…/dist/index.mjs"`). With `worker-mailer` in `serverExternalPackages`, OpenNext
  registers the package **entry** as a runtime module but not arbitrary subpaths, so the previous
  `worker-mailer/dist/index.mjs` subpath import resolved to an unregistered module id. Now import the
  package **root** (`worker-mailer`) and add a `patches/worker-mailer` `exports` map so the entry
  resolves to the ESM `.mjs` build (whose static `import { connect } from "cloudflare:sockets"`
  workerd resolves natively, vs the CJS build's `require`). (#220)

## [1.1.3] - 2026-06-09

### Fixed

- `Uncaught ReferenceError: __name is not defined` on every page load. The OpenNext/esbuild worker
  build instruments functions with an esbuild `__name` keep-names helper; next-themes serializes its
  anti-flash theme function via `Function.prototype.toString()` and injects it as an inline `<script>`,
  which then referenced `__name` in the browser global scope where it doesn't exist. Added a no-op
  `window.__name` shim as the first child of `<body>` (running before next-themes' injected script).
  Pre-existing issue (unrelated to the broadcast email work); non-fatal but noisy in the console. (#219)

## [1.1.2] - 2026-06-09

### Fixed

- Admin broadcast email send threw a 500 in production (`Dynamic require of "cloudflare:sockets" is
  not supported`). Next/Turbopack was compiling `worker-mailer` and rewriting its
  `import { connect } from "cloudflare:sockets"` into a CJS `require`, which the workerd runtime
  rejects. `worker-mailer` is now declared in `serverExternalPackages` so Next leaves it untouched,
  and `sendBulk` imports the package's ESM build (`worker-mailer/dist/index.mjs`) so the static
  `import` survives to the OpenNext bundle (paired with the existing `cloudflare:sockets` esbuild
  external from 1.1.1). Verified the built worker now emits an ESM `import … from "cloudflare:sockets"`
  with zero `require(...)`. (#218)

## [1.1.1] - 2026-06-09

### Fixed

- Production deploy: the v1.1.0 build failed during OpenNext bundling for Cloudflare Workers with
  `Could not resolve "cloudflare:sockets"` — the runtime built-in imported by `worker-mailer` (the
  admin broadcast email tool's SMTP transport). OpenNext's esbuild server bundle doesn't mark the
  `cloudflare:` scheme external and exposes no config hook to add one, so a `patch-package` patch
  appends `cloudflare:sockets` to that external list, with a `postinstall` hook so it applies in CI.
  `worker-mailer` is still bundled; only the runtime built-in stays external (workerd provides it). (#217)

## [1.1.0] - 2026-06-09

### Added

- Admin broadcast email tool (`/admin/messages`): compose a subject + raw-HTML body and send it to
  **all registered users** or **only users with a paid entry** in the active tournament. Includes a
  sandboxed-iframe HTML preview, a recipient-scope toggle with live count, a "Send test to me" button,
  and a confirmation dialog showing the recipient count before a broadcast. Sends are individually
  addressed (no shared BCC), paced, and hard-capped at 250 per send (surplus reported as `skipped`) to
  respect SMTP daily limits. The transport is runtime-aware — `worker-mailer` on the Cloudflare Workers
  runtime (production), with a `nodemailer` fallback under Node for local `next dev`; TLS is derived
  from `SMTP_SECURE` + port (465 implicit TLS, 587 STARTTLS, plain for local Mailpit). Backed by the
  `admin_list_recipient_emails` RPC (migration `0063`; SECURITY DEFINER + `is_admin()` gate) and
  `GET /api/admin/messages/recipients` + `POST /api/admin/messages/send`, both behind `requireAdmin()`.
  SMTP credentials are configured as Cloudflare Worker secrets. A new **Messages** admin nav tab and a
  reusable `Textarea` component are included. (#215)

## [1.0.13] - 2026-06-09

### Fixed

- Predictions wizard: in a new (Phase 1) prediction, clicking **Save progress** on the Group Stage
  step no longer skips Best 3rds and jumps to the Gut Feeling Champion step. The create flow requires
  a champion (the last Phase 1 step) for any server save, so "Save progress" — which can't persist
  yet — is now hidden until a champion is picked, instead of calling `persist()` and being bounced to
  the champion step. Picks are still checkpointed locally via the draft; "Save Phase 1 Picks" on the
  champion step remains the Phase 1 commit. The button is unchanged in edit mode (champion already
  set) and Phase 2. (#213)

## [1.0.12] - 2026-06-09

### Fixed

- Predictions wizard: editing a saved prediction and changing a group-stage 3rd-place pick that an
  existing Best-3rds (advancer) pick depended on no longer blocks you from progressing. The orphaned
  advancer — whose team is no longer one of your 3rd-place picks — is now pruned from state the moment
  the group changes (with a toast), and persisted alongside the group edit. Previously it lingered in
  state, so the autosave that fires on the next step transition sent it to `submit_predictions`, which
  rejected it (`advancer team … not in your 3rd-place picks`) and silently blocked navigation. The
  prune also covers the autofill / randomize / reset group helpers. (#210)

### Added

- Admin predictions list (`/admin/predictions`): a new read-only, tournament-wide table of every
  prediction (drafts + submitted) for the active tournament, ordered by most recently updated, with
  columns for user (email + username), prediction name, saved/submitted, and updated. Includes
  debounced search across email / username / prediction name and pagination, mirroring `/admin/users`.
  Backed by the `admin_list_predictions` RPC (migration `0062`; SECURITY DEFINER + `is_admin()` gate)
  and `GET /api/admin/predictions`. (`099a7b9`)
- Admin user search (`/admin/users`): the search box now also matches **prediction name**, scoped to
  the active tournament, so payments referenced by a prediction name (rather than username/email) can
  be linked to the owning account. Migration `0061` adds an `EXISTS` branch to `admin_list_users`;
  a user with multiple matching predictions still appears once. (#207)

### Changed

- Leaderboard is now **login-gated** (previously public), matching `/predictions` and `/results`.
  `/leaderboard` is added to the middleware's protected prefixes (logged-out users are redirected to
  `/login?next=%2Fleaderboard`), and `/api/leaderboard` returns `401` when unauthenticated as
  defense-in-depth. The nav link stays visible to logged-out users and routes them through login. (#208)

## [1.0.11] - 2026-06-03

### Added

- Account settings (`/account`): users can now **change their email address**. Submitting a new
  email sends confirmation links to both the current and new inbox (Supabase double-confirm); the
  change only takes effect once both are clicked. Links route through `/auth/callback`, which
  already verifies the `email_change` OTP type. (#205)
- Account settings (`/account`): a **"Delete account"** option in a new Danger-zone card, backed by
  a caller-scoped `delete_own_account()` RPC (migration `0060`). Deletion requires typing your own
  username to confirm (verified server-side) and is **blocked when the account has any paid
  leaderboard entry** (cash or free pick) or is an admin — those must be removed by the organizer
  first, preserving payment/leaderboard history. On success the user is signed out and FK cascades
  wipe predictions, payments, and referral links. (#205)

### Fixed

- Email-change confirmation link routing: added a custom `email_change` email template (and
  `[auth.email.template.email_change]` config) so the link points at `/auth/callback` instead of
  GoTrue's `/verify` route, which the local CLI builds in a form Kong can't route ("no Route matched
  with those values"). Mirrors the existing recovery/confirmation template overrides. (#205)

## [1.0.10] - 2026-06-02

### Changed

- Unpaid-prediction notice: the inline Interac logo is reduced to 20px and marked decorative
  (`alt=""` + `aria-hidden`) so screen readers don't announce "Interac" twice. (#203)

## [1.0.9] - 2026-06-02

### Added

- Unpaid-prediction notice (`/predictions` + `/leaderboard`): the official Interac logo now
  appears inline next to the word "Interac" in the e-transfer instructions. (#201)

## [1.0.8] - 2026-06-02

### Fixed

- Unpaid-prediction notice (`/predictions` + `/leaderboard`): the registered email the user
  must include in the Interac e-transfer message now renders as a high-contrast red chip and
  the copy is strengthened to "You MUST put your registered email … in the Interac message …
  without it your entries can't be credited." Previously it was easy-to-miss inline text. (#199)

## [1.0.7] - 2026-06-02

### Fixed

- Unpaid-prediction notice (`/predictions` + `/leaderboard`): removed the "Email payment
  to …" button and the `mailto:` links on the payments address — an Interac e-transfer is
  sent through the user's bank, not by email, so the button was misleading. The address is
  now plain selectable text, with a short "How to pay" instruction (online banking →
  Interac e-Transfer → send to the address). (#197)

## [1.0.6] - 2026-06-02

### Added

- Admin: a new **Referrals** tab where an admin can search any member, view their full
  referral state, and link/unlink referee accounts to credit referrals retroactively
  (e.g. signups that arrived without a `?ref=` link). Rewards stay purely derived
  (`floor(qualified/4) − redeemed`); `admin_add_referral` backfills `qualified_at` from
  the referee's earliest non-free payment, and every add/remove is recorded in a
  `referral_admin_audit` trail with actor, targets, and a required proof note. (#194)
- Unpaid-prediction payment prompts on `/predictions` and `/leaderboard`: a shared,
  persistent red notice tells the user how many entries are unpaid, the total CAD due,
  and to send an Interac e-transfer to the payments email including their registered
  account email. The predictions list tints unpaid rows red, and the leaderboard shows a
  dedicated "not ranked yet" table of the user's unpaid entries above the ranking. The
  nudge mirrors the leaderboard's own eligibility filter, so Phase 1 saved drafts
  (`submitted_at` null but a complete pick set) are included. (#195)

## [1.0.5] - 2026-06-02

### Added

- Rules page: a new "How the two phases work" card after the hero summarizes what each
  phase covers and the points it's worth — Phase 1 (group standings, Best 3rds advancers,
  Gut Feeling Champion) up to 150, Phase 2 (knockout bracket + Champion's Total Playoff
  Goals tiebreaker) up to 263, for a 413 maximum. Totals derive from the scoring
  constants. (#192)

### Changed

- Rules page: replaced the "up to five named predictions" copy — accounts can now create
  unlimited named predictions per tournament, so the rule reads "Multiple named
  predictions." (#191)
- Predictions wizard: the "Randomize" button is now labelled "Randomize Picks" in both the
  Group Stage and Best 3rds steps. (#190)

### Removed

- Predictions wizard: the "Auto-fill by FIFA ranking" buttons are hidden from the Group
  Stage and Best 3rds steps to encourage prediction variety. The autofill logic is
  preserved behind a `FEATURES.fifaAutofill` flag (default off) and can be re-enabled with
  a one-line change. (#189)

## [1.0.4] - 2026-06-01

### Added

- Predictions wizard: the Group Stage and Best 3rds steps now have a "Randomize" button
  (alongside "Auto-fill by FIFA ranking" and "Reset") that fills the picks with a random
  arrangement — shuffling each group into positions 1–4 and seeding 8 random advancers
  ranked 1–8. A "feeling lucky" alternative to the ranking-based auto-fill.

## [1.0.3] - 2026-06-01

### Added

- Predictions wizard: the Best 3rds step now has an "Auto-fill by FIFA ranking" button
  (paired with "Reset"), mirroring the Group Stage step. Auto-fill orders your candidate
  group 3rd-place picks by FIFA ranking and seeds ranks 1–8; it fills only what's
  available when the group stage isn't complete yet.

## [1.0.2] - 2026-05-31

### Added

- Leaderboard: non-admin users can now preview other members' brackets once the
  Group Stage is locked (`phase1_locked`), so people can compare group-stage picks.
  Preview is restricted again while knockout picks are editable (`phase2_open`) and
  reopens once the knockout bracket locks (`phase2_locked`). Owners always see their
  own; admins/super-admins always see everything.

### Fixed

- Auth: the Admin link (and other profile-gated UI) could silently stay hidden after a
  session was restored client-side but not resolved by the server — `AuthProvider` now
  loads the profile on `INITIAL_SESSION` when SSR provided none.

## [1.0.1] - 2026-05-31

### Fixed

- Rules page: replaced the vague "contact the pool organizer" payment bullet with
  concrete payment instructions — e-transfer to `payments@soccer-pool.com` (PayPal also
  accepted), and a reminder to include your username in the payment notes.

## [1.0.0] - 2026-05-30

First production release of the World Cup 2026 prediction game — a pure web app
(Next.js 16 + Supabase Postgres/Auth, deployed to Cloudflare Workers) where users
submit bracket predictions before a tournament-wide lock and earn points against
admin-submitted real-world results.

### Predictions & wizard

- Progressive multi-step wizard for group-stage standings, knockout bracket, Best
  3rd-place advancers, Gut Feeling Champion, and the tiebreaker.
- Unlimited named predictions per user per tournament; each is independently picked,
  paid, and ranked.
- Two-phase tournament model: Phase 1 (group + champion picks) locks before Phase 2
  (knockout bracket); phase-aware submit gating and read-only locked views.
- Phase 1 "Gut Feeling Champion" pick (+5), scored independently of the bracket Final.
- Group-stage autofill/reset, downstream knockout picks carried when an upstream
  winner changes, and a read-only bracket preview.

### Scoring

- Scoring v4: set-based group stage (10/15/7/5/2/0, Group I "Group of Death" pays 15),
  ranked Best 3rd-place advancers (up to 20), flat per-round knockout values
  (R32 +5 → Final +30, third-place +5), and the Gut Feeling Champion bonus (+5).
- Champion's Total Playoff Goals tiebreaker (closest prediction, then earliest submission).
- pgTAP test suite for `get_leaderboard`.

### Leaderboard & results

- Paginated public leaderboard (one row per paid prediction) with "find me" ranking,
  per-row bracket preview, and admin email visibility.
- Logged-in Results page tracking admin-entered outcomes as matches complete.
- Logged-in transparency/audit page with live pot stats and an accounting ledger.

### Free-pick programs

- Referral program: earn a free pick for every 4 referees whose first cash payment lands.
- Loyalty program: earn a free pick for every 5 cash-paid predictions in a tournament.
- Unified `/rewards` surface and `/api/rewards/*` API over both earning paths.

### Payments & charity

- Per-prediction offline payment model ($30 CAD entry, $5 charity portion), with an
  admin paid/unpaid toggle gating leaderboard eligibility.
- `/charities` page, per-charity logo breakdown, and a running raised total.

### Auth & admin

- Supabase email + password auth with auto-generated usernames, forgot/reset-password
  flow, and recovery-origin gating.
- Admin CRUD over user accounts and predictions, super-admin role, Reset Tournament
  action, and an expanded admin dashboard (pot, charity, rewards, top users).

### Platform

- Migrated from the original Solana/Anchor architecture to Supabase Auth + Postgres.
- Cloudflare Workers deployment via `@opennextjs/cloudflare` with CI (lint, typecheck,
  test, deploy) on push to `main`.
- Dark-mode default, container-query-driven priority+ navigation, and SEO no-index
  ahead of launch.

[1.0.4]: https://github.com/leedium/wc-2026-fantasy/releases/tag/v1.0.4
[1.0.3]: https://github.com/leedium/wc-2026-fantasy/releases/tag/v1.0.3
[1.0.2]: https://github.com/leedium/wc-2026-fantasy/releases/tag/v1.0.2
[1.0.1]: https://github.com/leedium/wc-2026-fantasy/releases/tag/v1.0.1
[1.0.0]: https://github.com/leedium/wc-2026-fantasy/releases/tag/v1.0.0
