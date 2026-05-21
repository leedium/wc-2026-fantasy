# CLAUDE.md

> **Version:** 3.3.0
> **Last Updated:** 2026-05-21

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
- `referrals` — one row per referred user. PK is `referee_id` (so each user can be referred only once). Holds `referrer_id`, the `referrer_code_used` snapshot, `qualified_at` (set by trigger when the referee's first non-free payment lands), `reward_redeemed_at` + `reward_prediction_id` (set when the referrer cashes the credit). DB CHECK blocks self-referral; no client writes — all mutations go through SECURITY DEFINER triggers/RPCs.
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
- **`get_leaderboard(p_tournament_id, p_page, p_page_size)`** — paginated, SECURITY DEFINER. Returns one row per **paid prediction** with columns `rank, prediction_id, prediction_name, username, points, group_points, advancer_points, knockout_points, champion_pick_points, total_goals, total_count`. A user with N paid predictions occupies N rows. `champion_pick_points` is 5 when `predictions.champion_team_id` equals the actual M32 winner, else 0; it is also folded into the `points` total used for ranking.
- **`get_leaderboard_rank(p_tournament_id, p_user_id, p_page_size)`** — returns one row per paid prediction the user owns: `(prediction_id, prediction_name, rank, page, points)`. The frontend picks the best row for "find me".
- **`admin_list_users(p_search, p_page, p_page_size)`** — returns `(id, username, is_admin, is_super_admin, prediction_count, paid_prediction_count, total_count)`.
- **`redeem_referral_credit(p_prediction_id)`** — SECURITY DEFINER, caller-scoped. Locks one available `referrals` row (`FOR UPDATE SKIP LOCKED` blocks double-spend), inserts a `tournament_payments` row with `is_free = true`, marks the referral redeemed. Raises `'not your prediction'` (→ 403), `'predictions are locked'` (→ 403), `'prediction already paid'` (→ 409), `'no referral credits available'` (→ 409), `'prediction not found'` (→ 404).
- **`get_referral_status()`** — caller-scoped aggregates only: `(referral_code, available_credits, qualified_total, redeemed_total)`. Never exposes the referee usernames; admins use `admin_list_user_referrals` for that.
- **`resolve_referrer_username(p_code)`** — SECURITY DEFINER, granted to `anon` + `authenticated`. Powers the pre-signup `/api/referrals/validate` "Invited by @user" affordance; returns NULL for invalid codes (no timing distinction between bad-format and unknown). Rate-limit at WAF.
- **`admin_list_user_referrals(p_user_id)`** — moderation view; returns inbound + outbound referrals for one user.
- **`referrals_sync_qualification()`** — trigger on `tournament_payments` AFTER INSERT/UPDATE/DELETE. Sets `referrals.qualified_at` when the referee's first non-free payment lands; clears it on delete only if the referrer has not yet redeemed the credit (redeemed credits are sticky so the referrer's leaderboard entry stays stable).

### Scoring (v2, in `migrations/0006_scoring_v2.sql`)

**Group stage** — set-based on the predicted top 2 vs actual top 2:
- both correct in exact order: `+6` (`+8` for Group I "Group of Death")
- both correct, swapped: `+4`
- one correct in correct slot: `+3`
- one correct in wrong slot: `+2`
- else `0`

3rd / 4th picks are unscored but still required by the form (3rd-place picks for groups A–H seed R32 via `knockout_matches.team_source = '3X'`). Max group points = 11×6 + 8 = **74**.

**Knockout** — per-round, per-advancing-team scoring with a "correct side" bonus. For each team that actually advanced from a deciding match, the user scores the higher tier if they predicted that match's winner correctly, the lower tier if they predicted that team to win some other match in the same stage, else 0:

| Round (advancing to)      | deciding stage    | correct slot | wrong slot |
|---------------------------|-------------------|--------------|------------|
| Round of 16               | round_of_32       | +5           | +3         |
| Quarter-finals            | round_of_16       | +6           | +3         |
| Semi-finals               | quarter_finals    | +8           | +4         |
| Final                     | semi_finals       | +10          | +5         |

Plus flat bonuses on top: champion (M32 winner) `+15`, third-place winner (M31) `+5`. Round of 32 picks aren't scored directly — they decide R16 slots. The legacy `knockout_matches.point_value` column is still in the schema but the v2 RPCs ignore it. Max knockout points = 80 + 48 + 32 + 20 + 15 + 5 = **200**. Helper function `public.knockout_round_scores(tournament_id, stage, correct_pts, wrong_pts)` is shared by `get_leaderboard` and `get_leaderboard_rank`.

**Phase 1 Champions Pick** — `+5` if `predictions.champion_team_id` matches the actual M32 winner. Independent of the bracket Final (M32) pick scoring (`+15`) — users can pick the same team for both (so a correct gut pick + correct bracket Final stacks to `+20`), or split between them. The pick is collected via a dropdown as the first wizard step, required at create time, and writable only while the tournament is in `phase1`; once `phase1_locked` (or later) it is frozen.

**Tiebreaker** — closest prediction to the *champion's* total goals across all 8 of their tournament matches (regulation + extra time only; no penalty-shootout goals). Stored on `tournaments.champion_total_goals` (admin-entered when the tournament ends). `predictions.total_goals` is reused with a relaxed CHECK of `between 0 and 50`.

**Grand total max: 74 + 10 + 200 + 5 = 289.** (Group 74 + Advancers 10 + Knockout 200 + Champion Pick 5.)

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
- `/referrals` — protected hub showing the user's referral code + share URL and the (free picks available / friends paid / credits used) tally. `/register?ref=<code>` is the deep link target.
- `/auth/callback` — Supabase auth code exchange

### API routes (`src/app/api/*`)

`tournament`, `groups`, `teams`, `knockout-matches` — read-only metadata.
`predictions` — `GET` (list of current user's predictions) + `POST` (create; body includes `predictionName`).
`predictions/[id]` — `GET` / `PATCH` / `DELETE` per prediction.
`admin/users/[id]/predictions` — list + create on behalf of a user.
`admin/users/[id]/predictions/[predictionId]` — per-prediction admin CRUD.
`admin/predictions/[predictionId]/payment` — `GET` / `PATCH` per-prediction payment toggle (`admin_set_prediction_payment`).
`leaderboard` — paginated list (rows include `predictionId` + `predictionName`). `leaderboard/me` — `matches[]` with one entry per paid prediction the user owns.

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
- **Phase 1 Champions Pick**: one team picked from the 48 as your tournament champion. Required at prediction-creation time, collected as the first wizard step, and locked when Phase 1 ends. Independent of the bracket Final (M32) pick — both score separately.
- Group stage: predict positions 1–4 for all 12 groups; only the top 2 finishers are scored (set-based 6/4/3/2/0 with a +8 exact-order bonus for Group I, the "Group of Death")
- Knockout: predict winners R32 → Final. R32 picks decide which teams sit in your R16 slots and aren't scored directly; R16/QF/SF/Final score per advancing team with correct-side / wrong-side tiers; champion and third-place winner each get a flat bonus
- Tiebreaker: closest prediction to the champion's total tournament goals (regulation + extra time across their 8 matches; penalty-shootout goals excluded)

## Oracle Design

Admin-controlled v1: an admin (`profiles.is_admin = true`) submits final group standings after group stage and knockout results as matches complete. RLS restricts these writes to admins. Can upgrade to multi-sig or automated feed later.

## Workflow Notes

- **Run tests / typecheck before declaring done**: `cd frontend && npm test && npm run typecheck && npm run lint`. The suite covers the proxy auth gate, API routes, AuthProvider, and prediction forms; if you change schema, RLS, or RPC contracts, the API route tests will catch most regressions.
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


## SQL Statements

``````
-- Bypass the trigger just for this statement
 set session_replication_role = 'replica';

 -- Option A: by username
 update public.profiles
 set is_admin = true
 where id = (select id from auth.users where email = 'email@me.com');

set session_replication_role = 'origin';
