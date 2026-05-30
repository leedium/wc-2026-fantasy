# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/leedium/wc-2026-fantasy/releases/tag/v1.0.0
