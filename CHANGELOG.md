# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
