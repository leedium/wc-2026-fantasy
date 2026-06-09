# CLAUDE.md

> **Version:** 3.8.0
> **Last Updated:** 2026-06-09

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

World Cup 2026 prediction game. Users register with a username/password, submit bracket predictions (group stage standings + knockout bracket + total goals tiebreaker) before a single tournament-wide lock time, and earn points based on how their predictions compare to admin-submitted real-world results. A leaderboard ranks all participants.

**No blockchain, no wallets** — this is a pure web app backed by Supabase Postgres + Auth. Entry is paid out-of-band ($30 CAD per prediction; $5 of each entry is allocated to a charity the pool organizer announces before lock; an admin marks `tournament_payments` paid before lock); see `frontend/src/lib/constants.ts` (`PRICING.entryFeeCAD` + `PRICING.charityPortionCAD`) and migration `0008_payments.sql`. The earlier Solana/Anchor architecture has been removed; any references to wallets, SOL, prize pools, or `@solana/*` packages are stale.

## Tech Stack

- **Frontend**: Next.js 16 (App Router, SSR), React 19, Tailwind CSS 4, shadcn/ui (Radix), Zustand, TanStack React Query
- **Auth + DB**: Supabase (Postgres + Auth), `@supabase/ssr` for cookie-based session handling in server components and the proxy
- **Deployment**: Cloudflare Workers via `@opennextjs/cloudflare` (`npm run preview` / `npm run deploy`)
- **Testing**: Jest 29, React Testing Library, mixed `jsdom` / `node` environments

## Repository Layout

```
WC2026/
├── frontend/                    Next.js app (the entire client + API)
│   ├── src/
│   │   ├── app/                 App Router pages + route handlers (api/*)
│   │   ├── components/          UI: layout, predictions, leaderboard, shared, ui (shadcn)
│   │   ├── providers/           AuthProvider, QueryProvider, ThemeProvider
│   │   ├── lib/supabase/        client.ts (browser), server.ts (RSC/route), admin.ts (service role)
│   │   ├── proxy.ts             Auth gate for /predictions and /admin (Next.js 16 proxy convention)
│   │   ├── stores/              Zustand store (UI-only state)
│   │   └── test-utils/          Shared fixtures for component tests
│   ├── jest.setup.tsx           Mocks for next/navigation, next/image, browser APIs
│   └── wrangler.toml            Cloudflare Workers config
└── supabase/
    ├── migrations/              0001 schema, 0002 RLS, 0003 triggers + RPCs, 0004 leaderboard RPCs
    ├── seed.sql                 12 groups, 48 teams, 31 knockout matches, 1 active tournament
    └── config.toml
```

## Database Architecture

All schema/policies/RPCs live in `supabase/migrations/`. Run `supabase db reset` to rebuild from scratch.

### Tables

- `profiles` — 1:1 with `auth.users`. Holds `username` (citext, unique, 3–24 chars, `[A-Za-z0-9_]`), `display_name`, `avatar_url`, `is_admin`. Auto-created via `handle_new_user` trigger; if `raw_user_meta_data.username` is missing (default for self-signup), the trigger generates `user_<8 hex chars>` with a 10-attempt collision retry. Admin-create flows still pass an explicit username.
- `tournaments` — single active tournament enforced by partial unique index. Holds `lock_time` (single tournament-wide deadline) and `status` (`upcoming|group_stage|knockout|completed`).
- `groups` (12: A–L), `teams` (48, FK to groups), `knockout_matches` (31, R32 → final, with `team1_source`/`team2_source` strings like `"M1"` or `"A1"`).
- `predictions` — **many per `(user, tournament)`**, no quantity limit. Each has a unique `prediction_name` per user/tournament (case-insensitive), 1–60 chars matching `^[A-Za-z0-9 _\-.''‘’]+$`. Holds `total_goals` tiebreaker, `champion_team_id` (the Phase 1 Champions Pick — nullable for legacy rows; required on new prediction creation), and submission timestamp.
- `group_predictions` — normalized: 12 rows per prediction with `first_team_id`/`second_team_id`/`third_team_id`/`fourth_team_id`. CHECK enforces all four are distinct. PK is `(prediction_id, group_id)`.
- `knockout_predictions` — one per `(prediction, match)` with predicted winner.
- `tournament_payments` — one per `prediction_id` (UNIQUE). Payment is per-prediction, not per-user. Each paid prediction is its own ranked entry on the leaderboard. Has an `is_free boolean` (default `false`) that flags rows created via the referral-redeem flow rather than admin-recorded cash.
- `referral_codes` — one per `user_id`, holding a unique 8-char citext code drawn from a 31-symbol unambiguous alphabet (no `0/O/1/I/L`). Kept in its own table (rather than on `profiles`) so the `profiles_select_all` policy doesn't expose codes to enumeration. Auto-populated by the `handle_new_user` trigger; backfilled for older rows in migration `0035_referrals.sql`.
- `referrals` — one row per referred user. PK is `referee_id` (so each user can be referred only once). Holds `referrer_id`, the `referrer_code_used` snapshot, and `qualified_at` (set by trigger when the referee's first non-free payment lands). Pure social-graph ledger now — redemption tracking lives in `referral_redemptions`. DB CHECK blocks self-referral; no client writes — all mutations go through SECURITY DEFINER triggers/RPCs.
- `referral_redemptions` — append-only ledger for the referrals free-pick program (migration `0039_referrals_threshold.sql`). One row per redeemed referral credit, holding `(user_id, prediction_id UNIQUE, redeemed_at, qualified_count_at_redemption)`. The "earned" side is derived — `floor(qualified_total / 4)` lifetime — so admin reversals of cash payments naturally drop `available_credits` while already-redeemed credits stay sticky. Threshold is 4 paid referrals per free pick.
- `loyalty_redemptions` — append-only ledger for the loyalty-rewards program (migration `0038_loyalty_credits.sql`). One row per redeemed loyalty credit, holding `(user_id, tournament_id, prediction_id UNIQUE, redeemed_at, cash_paid_count_at_redemption)`. The "earned" side is derived — `floor(non_free_paid_count / 5)` per tournament — so admin reversals of cash payments naturally drop `available_credits` while already-redeemed credits stay sticky.
- `group_standings`, `knockout_results` — admin-submitted truth for scoring.

### Auth + RLS

- Auth is Supabase email+password (signup no longer collects username — auto-generated by `handle_new_user`). The trigger only raises `'username taken'` / `'username invalid format'` on the explicit-username admin path, or `'could not generate unique username'` if the 10-attempt retry exhausts.
- Every table has RLS enabled. Helpers: `is_admin()` (SECURITY DEFINER, STABLE) and `is_before_lock(tid)`.
- `predictions` SELECT is `own_or_admin` — regular users only see their own rows. **This is why the leaderboard cannot use a plain view.** Users can DELETE their own predictions pre-lock, but only when the prediction is **not paid** (RLS enforces; admins must mark unpaid first to preserve payment history).
- `tournament_payments` SELECT is gated by ownership-via-prediction (`exists (select 1 from predictions pr where pr.id = tournament_payments.prediction_id and pr.user_id = auth.uid())`).

### RPCs (the trust boundary)

- **`submit_predictions(payload jsonb)`** — single transaction. Payload includes optional `prediction_id` (omit to create, present to update), required-on-create `prediction_name`, and required-on-create `champion_team_id` (the Phase 1 Champions Pick — only writable while `tournament_phase = 'phase1'`). Users can create unlimited predictions per `(user, tournament)`; `prediction_name` uniqueness is enforced by the unique index. Raises `'predictions are locked'` (→ 403), `'prediction name taken'` (→ 409), `'prediction name required'` (→ 400), `'champion pick required'` (→ 400), `'prediction not found'` (→ 404).
- **`admin_submit_predictions(p_user_id, payload)`** — same branching, no auth/lock check, scoped to the target user.
- **`admin_set_prediction_payment(p_prediction_id, p_paid, p_paid_at)`** — replaces the old `admin_set_payment(user_id, tournament_id, …)`. Upserts `tournament_payments` keyed on `prediction_id`.
- **`get_leaderboard(p_tournament_id, p_page, p_page_size)`** — paginated, SECURITY DEFINER. Returns one row per **paid prediction** with columns `rank, prediction_id, prediction_name, username, points, group_points, advancer_points, knockout_points, champion_pick_points, total_goals, total_count`. A user with N paid predictions occupies N rows. `champion_pick_points` is 5 when `predictions.champion_team_id` equals the actual M104 winner, else 0; it is also folded into the `points` total used for ranking.
- **`get_leaderboard_rank(p_tournament_id, p_user_id, p_page_size)`** — returns one row per paid prediction the user owns: `(prediction_id, prediction_name, rank, page, points)`. The frontend picks the best row for "find me".
- **`admin_list_users(p_search, p_page, p_page_size)`** — returns `(id, username, email, is_admin, is_super_admin, prediction_count, paid_prediction_count, total_rewards, total_count)`. `email` is sourced from `auth.users` (safe because the RPC is SECURITY DEFINER + admin-gated). `total_rewards = floor(qualified_referrals / 4) + floor(active_tournament_cash_paid / 5)` — engagement view, not "available" (no redemption subtraction).
- **`redeem_referral_credit(p_prediction_id)`** — internal building block (called by `redeem_free_pick`). SECURITY DEFINER, caller-scoped. Takes a per-user transactional advisory lock, recomputes `available_credits = floor(qualified_total / 4) - redeemed_total` inside the lock, inserts a `referral_redemptions` row and a free `tournament_payments` row. Raises `'not your prediction'` (→ 403), `'predictions are locked'` (→ 403), `'prediction already paid'` (→ 409), `'no referral credits available'` (→ 409), `'prediction not found'` (→ 404).
- **`get_referral_status()`** — internal building block (called by `get_rewards_status`). Caller-scoped aggregates only: `(referral_code, qualified_total, earned_credits, redeemed_total, available_credits)` where `earned_credits = floor(qualified_total / 4)` and `available_credits = greatest(0, earned_credits - redeemed_total)`. Never exposes the referee usernames; admins use `admin_list_user_referrals` for that.
- **`redeem_loyalty_credit(p_prediction_id)`** — internal building block (called by `redeem_free_pick`). SECURITY DEFINER, caller-scoped. Takes a per-user+tournament transactional advisory lock, recomputes `available_credits` inside the lock, inserts a `loyalty_redemptions` row and a free `tournament_payments` row. Raises `'no loyalty credits available'` (→ 409) plus the same prediction-state errors as `redeem_referral_credit`.
- **`get_loyalty_status(p_tournament_id)`** — internal building block (called by `get_rewards_status`). Returns `(cash_paid_count, earned_credits, redeemed_credits, available_credits)` for the caller in the given tournament.
- **`get_rewards_status(p_tournament_id)`** — client-facing read. Merges referral + loyalty into one flat row consumed by `/api/rewards/status` + `useRewardsStatus`. Returns `(referral_code, total_available, referral_*, loyalty_*)`.
- **`redeem_free_pick(p_prediction_id)`** — client-facing write. Tries `redeem_referral_credit` first (referrals are slower to acquire, so burning them first keeps the user's own paying activity generating loyalty credits at the same rate), falls back to `redeem_loyalty_credit`. Returns `(payment_id, source)` where `source` ∈ `'referral' | 'loyalty'`. Raises `'no free picks available'` (→ 409) only if both sources are empty.
- **`resolve_referrer_username(p_code)`** — SECURITY DEFINER, granted to `anon` + `authenticated`. Powers the pre-signup `/api/referrals/validate` "Invited by @user" affordance; returns NULL for invalid codes (no timing distinction between bad-format and unknown). Rate-limit at WAF.
- **`admin_list_user_referrals(p_user_id)`** — moderation view; returns inbound + outbound referrals for one user.
- **`referrals_sync_qualification()`** — trigger on `tournament_payments` AFTER INSERT/UPDATE/DELETE. Sets `referrals.qualified_at` when the referee's first non-free payment lands; clears it on delete when the referee has no remaining non-free payments. With the aggregate model in `0039_referrals_threshold.sql`, the clear is unconditional — the `greatest(0, …)` clamp in `get_referral_status` absorbs the rare clawback-after-redeem case (already-redeemed free picks stay sticky on the leaderboard).

### Scoring (v4 + revisions, in `migrations/0051_scoring_v4.sql`, `0053`, `0054`)

**Group stage** — set-based on the predicted top 2 vs actual top 2:
- both correct in exact order: `+10` (`+15` for Group I "Group of Death")
- both correct, swapped: `+7`
- one correct team in its correct slot: `+5`
- one correct team in the wrong slot: `+2`
- else `0`

3rd / 4th picks are unscored in the group total; the 3rd-place picks feed the separate Best 3rds advancers step. Max group points = 11×10 + 15 = **125**. The group rebalance landed in `0054_group_scoring_rebalance.sql`; the group CASE is inlined in both `get_leaderboard` and `get_leaderboard_rank` (so both are re-emitted there).

**Best 3rd-place advancers** — 8 ranked picks drawn from your group 3rd-placers. Each pick that lands in the actual top-8 advancers scores `+2.0`, with a `+0.5` bonus when its predicted rank also matches the actual rank (`+2.5` total). Max advancer points = 8 × 2.5 = **20**.

**Knockout** — flat, per-match-winner scoring (no wrong-slot / correct-side bonus — v4 collapsed the old tiers). For each match you score the round's value if you picked the actual winner, else 0:

| Round            | matches | points each |
|------------------|---------|-------------|
| Round of 32      |   16    | +5          |
| Round of 16      |    8    | +8          |
| Quarter-finals   |    4    | +12         |
| Semi-finals      |    2    | +18         |

Plus flat bonuses: Final (M104) winner `+30` (this absorbs the legacy round + champion bonus — there is no separate champion column), third-place (M103) winner `+5`. Max knockout points = 80 + 64 + 48 + 36 + 30 + 5 = **263**. R32–SF values come from `public.knockout_round_config()` (passed through `public.knockout_round_scores(tournament_id, stage, correct_pts, wrong_pts)` with `wrong_pts = 0`); the M104/M103 bonuses come from `scoring_champion_pts()` / `scoring_third_place_pts()` (the latter restored to `+5` in `0053_restore_third_place_scoring.sql`). The legacy `knockout_matches.point_value` column is still in the schema but the v4 RPCs ignore it. Tweaks only need a `create or replace` of the relevant config function.

**Gut Feeling Champion (Phase 1)** — `+5` (from `scoring_champion_pick_pts()`) if `predictions.champion_team_id` matches the actual M104 winner. Independent of the bracket Final (M104) pick scoring (`+30`) — users can pick the same team for both (so a correct gut pick + correct bracket Final stacks to `+35`), or split between them. The pick is collected via a dropdown as the final Phase 1 wizard step (after Best 3rds), required at create time, and writable only while the tournament is in `phase1`; once `phase1_locked` (or later) it is frozen.

**Tiebreaker (Champion's Total Playoff Goals)** — closest prediction to the *champion's* total goals across their 5 playoff matches (R32 → Final), including regulation, extra time, **and** penalty-shootout goals. Admin-entered on `tournaments.champion_total_goals` when the tournament ends. `predictions.total_goals` is reused with a CHECK of `between 0 and 200` (the wizard suggests a 1–50 range via the input placeholder; the hard bound stays 0–200). `get_leaderboard` / `get_leaderboard_rank` break a points tie by smallest `abs(total_goals − champion_total_goals)`, then earliest `submitted_at` — which is exactly what the user-facing copy (TiebreakerInput + Rules) describes ("closest prediction wins; if equally close, earliest submission wins").

**Grand total max: 125 + 20 + 263 + 5 = 413.** (Group 125 + Advancers 20 + Knockout 263 + Champion Pick 5.)

## Free-Pick Programs

Two earning paths, one unified redemption surface. Both deposit an `is_free = true` row in `tournament_payments` which the leaderboard treats identically to a cash payment.

- **Referrals** (`0035_referrals.sql` + `0039_referrals_threshold.sql`): invite friends with your code; for every **4 referees** whose first cash payment lands, earn 1 free pick. Lifetime-scoped (no tournament_id on the `referrals` table). Free-pick payments do *not* count toward referrer qualification (the trigger filters on `is_free = false`). Earning is derived (`floor(qualified_total / 4)`), redemption ledger is `referral_redemptions`.
- **Loyalty** (`0038_loyalty_credits.sql`): for every 5 cash-paid predictions you have in a tournament, earn 1 free pick redeemable in that same tournament. Per-tournament; free picks don't compound (the count gates on `is_free = false`).

Client-facing API surface is `/api/rewards/*` driven by `redeem_free_pick` + `get_rewards_status`. The per-source RPCs (`redeem_referral_credit`, `redeem_loyalty_credit`, `get_referral_status`, `get_loyalty_status`) are kept as internal building blocks. Redemption order: referral first (slower to acquire socially, so burning it first keeps loyalty accruing).

## Frontend Architecture

### App Router routes

- `/` — landing page
- `/login`, `/register` — Supabase email auth (server-redirected if already signed in)
- `/predictions` — protected list/hub: shows the user's predictions for the active tournament + a "New prediction" button (hidden when locked).
- `/predictions/new` — wizard in create mode; on submit, redirects to `/predictions/[id]`.
- `/predictions/[id]` — wizard in edit mode; server-fetches the prediction and passes as `initial` prop.
- `/leaderboard` — public; uses `/api/leaderboard` and `/api/leaderboard/me`
- `/admin/users` — admin user list (per-user predictions count + paid count).
- `/admin/users/[id]` — list of a user's predictions with per-prediction payment toggle and edit/delete.
- `/admin/users/[id]/predictions/new` and `/admin/users/[id]/predictions/[predictionId]` — admin editor mounted on the same wizard component (`PredictionsPageContent` accepts `apiBasePath` + `redirectAfterCreate` props).
- `/referrals` — protected share-link page: user's referral code + share URL + share button. `/register?ref=<code>` is the deep link target. Credit counts live on `/rewards`.
- `/rewards` — protected credit hub showing referral activity (free picks available / friends paid / credits used) and loyalty activity (free picks available / cash predictions paid / credits redeemed + progress toward next free pick). Backed by `/api/rewards/status`.
- `/auth/callback` — Supabase auth code exchange

### API routes (`src/app/api/*`)

`tournament`, `groups`, `teams`, `knockout-matches` — read-only metadata.
`predictions` — `GET` (list of current user's predictions) + `POST` (create; body includes `predictionName`).
`predictions/[id]` — `GET` / `PATCH` / `DELETE` per prediction.
`admin/users/[id]/predictions` — list + create on behalf of a user.
`admin/users/[id]/predictions/[predictionId]` — per-prediction admin CRUD.
`admin/predictions/[predictionId]/payment` — `GET` / `PATCH` per-prediction payment toggle (`admin_set_prediction_payment`).
`leaderboard` — paginated list (rows include `predictionId` + `predictionName`). `leaderboard/me` — `matches[]` with one entry per paid prediction the user owns.
`rewards/status` — `GET` for the unified free-pick state (referral + loyalty merged). `rewards/redeem` — `POST { predictionId }` to consume one free pick (referral first, then loyalty); returns `{ paymentId, source }`. The single source for the menu credit badge, predictions banner, `<ReferralActivityCard />`, `<LoyaltyActivityCard />`, and `<RewardsSummaryCard />` is the `useRewardsStatus` hook.
`referrals/validate` — pre-signup public lookup; rate-limited at WAF.

### Supabase clients

- `lib/supabase/client.ts` → `createSupabaseBrowserClient()` for client components
- `lib/supabase/server.ts` → `getServerSupabase()` for RSC and route handlers (cookies via `@supabase/ssr`)
- `lib/supabase/admin.ts` → service-role client; **server-only**, never import from a client component

### Key patterns

- `AuthProvider` wraps the app; `useAuthContext()` returns `{user, profile, loading, signOut, refreshProfile}` and falls back to a no-op default outside the provider (so isolated component tests don't need to mount it).
- `GroupStageForm` and `KnockoutBracket` take `groups`/`matches`/`teams` as props (no internal data fetching) so they're trivially testable.
- Predictions submit goes `client → POST /api/predictions → submit_predictions RPC → DB`. Validation happens at the RPC, not in the route handler — the route just translates errors into HTTP status codes.

## Game Mechanics

- 48 teams, 12 groups (A–L, 4 teams each), 104 total matches
- Each user can create as many named predictions per tournament as they like. Each prediction is independent (own picks, own tiebreaker, own payment).
- All predictions submitted upfront before a single tournament-wide lock time (users may edit any of their predictions until lock)
- Payment is **per prediction**: each one must be marked paid by an admin before lock to be eligible. The leaderboard shows one row per paid prediction (a user with N paid predictions occupies N rows).
- **Gut Feeling Champion** (Phase 1): one team picked from the 48 as your tournament champion. Required at prediction-creation time, collected as the final Phase 1 wizard step (after Best 3rds), and locked when Phase 1 ends. Independent of the bracket Final (M104) pick — both score separately.
- Group stage: predict positions 1–4 for all 12 groups; only the top 2 finishers are scored (set-based 10/7/5/2/0 — exact / reversed / right-slot / wrong-slot / none — with Group I, the "Group of Death", paying 15 for an exact top-2 instead of 10)
- Knockout: predict winners R32 → Final. Each correct match winner scores a flat per-round value (R32 +5, R16 +8, QF +12, SF +18); the Final (M104) winner pays +30 and the third-place (M103) winner +5
- Tiebreaker — Champion's Total Playoff Goals: closest prediction to the champion's total goals across their 5 playoff matches (R32 → Final), including regulation, extra time, and penalty-shootout goals; broken by the closest prediction, then earliest submission

## Oracle Design

Admin-controlled v1: an admin (`profiles.is_admin = true`) submits final group standings after group stage and knockout results as matches complete. RLS restricts these writes to admins. Can upgrade to multi-sig or automated feed later.

## Workflow Notes

- **Run tests / typecheck before declaring done**: `cd frontend && npm test && npm run typecheck && npm run lint`. The suite covers the proxy auth gate, API routes, AuthProvider, and prediction forms; if you change schema, RLS, or RPC contracts, the API route tests will catch most regressions.
- **Never verify against production.** Do not run, test, or validate changes against the production environment (prod URLs, prod Supabase, prod data) unless the user explicitly instructs you to, or you ask for and receive permission first. Automated tests, typecheck/lint, and local runs are the default verification path. Do not assume a "low-risk display fix" may be verified on prod — confirm with the user every time.
- **Migrations are append-only** in this repo style. Don't edit prior migration files — add a new `000N_*.sql`. (Current migrations are still numbered 0001–0004 because they're pre-deploy; once you've run against a real Supabase project, treat them as frozen.)
- **Don't trust the client**: any new mutation must validate at the RPC boundary, not in the route handler.
- **Never import `lib/supabase/admin.ts` from a client component** — service-role key would leak.
- **Cloudflare Workers runtime**: `npm run preview` builds with OpenNext and runs locally on the Worker runtime. If you add a Node-only dep, expect to need `compatibility_flags = ["nodejs_compat"]` in `wrangler.toml` (already set) or to find an edge-friendly alternative.
- **Local dev accounts must survive `supabase db reset`.** `supabase db reset` wipes `auth.users` along with everything else and reruns migrations + `seed.sql`. Any account you want preserved across resets must be re-seeded from `supabase/seed.sql` (local-only, never runs against prod). To add one: insert into `auth.users` (with `extensions.crypt(password, extensions.gen_salt('bf'))`) + `auth.identities`, both with stable UUIDs guarded by `on conflict do nothing`. The `handle_new_user` trigger creates the profile from `raw_user_meta_data.username`. To set `is_admin` / `is_super_admin`, temporarily `disable trigger profiles_block_super_admin_change` on `public.profiles`, update, re-enable — `set session_replication_role = 'replica'` won't work in seed because seed runs as the non-superuser `postgres` role.

## Production rate limits (Cloudflare WAF)

App-level rate limiting isn't implemented (Cloudflare Workers' multi-instance model makes in-memory counters unreliable). Configure these rules in **Cloudflare Dashboard → Security → WAF → Rate limiting rules** before launch:

| Path | Threshold | Window | Action |
|------|-----------|--------|--------|
| `/api/auth/forgot-password` | 5 requests | 1 minute | Block |
| `/api/auth/reset-password` | 5 requests | 1 minute | Block |
| `/login`, `/register` (POST) | 10 requests | 1 minute | Challenge |
| `/api/admin/users/*/password-reset` | 10 requests | 5 minutes | Block |
| `/api/admin/*` | 100 requests | 1 minute | Block |
| `/api/referrals/validate` | 10 requests | 1 minute | Block |
| Site-wide | 600 requests | 1 minute | Challenge |

All by client IP. The first three protect against email enumeration / mailbox flooding; the admin rules cap blast radius if an admin account is compromised; the site-wide rule absorbs basic scraping.

## Git Commits

- Do not include "Co-Authored-By" lines in commit messages.
- **Never push directly to `main`.** All changes — including small follow-up fixes — must land on a feature branch and go through a pull request. Even one-line fixes during a session: branch, commit, push, open PR.


## Versioning & Releases

This project follows [Semantic Versioning](https://semver.org/) **strictly** — the CHANGELOG header is not aspirational. The version in `frontend/package.json` must match the git tag and GitHub release, and the bump is derived mechanically from the CHANGELOG sections in that release:

- **MAJOR** (`2.0.0`) — any breaking change.
- **MINOR** (`1.1.0`, resets PATCH to `0`) — any non-breaking `### Added` or `### Changed`.
- **PATCH** (`1.0.13`) — the release contains **only** `### Fixed` (and/or internal/doc-only changes).

A release that bundles features and fixes takes the **highest** applicable bump — features ⇒ MINOR even if fixes ride along. **Never patch-bump a release that ships a feature** (this is the rule the `1.0.x` line violated through 1.0.12; correct it going forward, but don't renumber already-published tags).

### Release flow

1. Branch `release/vX.Y.Z` off `main`.
2. Bump `frontend/package.json` to `X.Y.Z` and prepend a `## [X.Y.Z] - YYYY-MM-DD` CHANGELOG section covering **every** PR merged since the last release, grouped into `### Added` / `### Changed` / `### Fixed`, each line referencing its `#PR`. Pick `X.Y.Z` by applying the bump rules above to those grouped sections. Commit: `chore(release): vX.Y.Z — changelog entry and version bump`.
3. PR → merge to `main`.
4. Annotated tag `vX.Y.Z` on the merge commit, push it, then publish the GitHub release from the CHANGELOG body: `gh release create vX.Y.Z --latest --notes-file <body>`.

## SQL Statements

``````
-- Bypass the trigger just for this statement
 set session_replication_role = 'replica';

 -- Option A: by username
 update public.profiles
 set is_admin = true
 where id = (select id from auth.users where email = 'email@me.com');

set session_replication_role = 'origin';
