# CLAUDE.md

> **Version:** 3.0.0
> **Last Updated:** 2026-04-30

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

World Cup 2026 prediction game. Users register with a username/password, submit bracket predictions (group stage standings + knockout bracket + total goals tiebreaker) before a single tournament-wide lock time, and earn points based on how their predictions compare to admin-submitted real-world results. A leaderboard ranks all participants.

**No blockchain, no wallets, no entry fees** — this is a pure web app backed by Supabase Postgres + Auth. The earlier Solana/Anchor architecture has been removed; any references to wallets, SOL, prize pools, or `@solana/*` packages are stale.

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

- `profiles` — 1:1 with `auth.users`. Holds `username` (citext, unique, 3–24 chars, `[A-Za-z0-9_]`), `display_name`, `avatar_url`, `is_admin`. Auto-created via `handle_new_user` trigger from the signup metadata.
- `tournaments` — single active tournament enforced by partial unique index. Holds `lock_time` (single tournament-wide deadline) and `status` (`upcoming|group_stage|knockout|completed`).
- `groups` (12: A–L), `teams` (48, FK to groups), `knockout_matches` (31, R32 → final, with `team1_source`/`team2_source` strings like `"M1"` or `"A1"`).
- `predictions` — one per `(user, tournament)`. Holds `total_goals` tiebreaker + submission timestamp.
- `group_predictions` — normalized: 12 rows per user-tournament with `first_team_id`/`second_team_id`/`third_team_id`/`fourth_team_id`. CHECK enforces all four are distinct.
- `knockout_predictions` — one per `(user, tournament, match)` with predicted winner.
- `group_standings`, `knockout_results` — admin-submitted truth for scoring.

### Auth + RLS

- Auth is Supabase email+username+password. The `handle_new_user` trigger reads `raw_user_meta_data->>'username'` to populate `profiles`. On collision it raises `'username taken'` (errcode `P0001`); on format violation it raises `'username invalid format'`. `RegisterForm.tsx` matches on these explicit strings.
- Every table has RLS enabled. Helpers: `is_admin()` (SECURITY DEFINER, STABLE) and `is_before_lock(tid)`.
- `predictions` SELECT is `own_or_admin` — regular users only see their own row. **This is why the leaderboard cannot use a plain view.**

### RPCs (the trust boundary)

- **`submit_predictions(payload jsonb)`** — single transaction that inserts/updates `predictions`, `group_predictions`, and `knockout_predictions`. Server-side validates that each team belongs to the claimed group (defense-in-depth: the UI already prevents this, but never trust the client). Raises `'predictions are locked'` past `lock_time` (caller maps to HTTP 403).
- **`get_leaderboard(p_tournament_id, p_page, p_page_size)`** — paginated, SECURITY DEFINER so it can read all `predictions` past the RLS policy. Returns rows + `total_count`.
- **`get_leaderboard_rank(p_tournament_id, p_username, p_page_size)`** — returns `{rank, page, points}` for one user. Used by `/api/leaderboard/me` so "find my rank" doesn't fetch 1000 rows client-side.

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

**Tiebreaker** — closest prediction to the *champion's* total goals across all 8 of their tournament matches (regulation + extra time only; no penalty-shootout goals). Stored on `tournaments.champion_total_goals` (admin-entered when the tournament ends). `predictions.total_goals` is reused with a relaxed CHECK of `between 0 and 50`.

**Grand total max: 74 + 200 = 274.**

## Frontend Architecture

### App Router routes

- `/` — landing page
- `/login`, `/register` — Supabase email auth (server-redirected if already signed in)
- `/predictions` — protected; `proxy.ts` (Next.js 16 proxy file convention) redirects unauthenticated requests to `/login?next=/predictions`
- `/leaderboard` — public; uses `/api/leaderboard` and `/api/leaderboard/me`
- `/auth/callback` — Supabase auth code exchange

### API routes (`src/app/api/*`)

`tournament`, `groups`, `teams`, `knockout-matches` — read-only metadata.
`predictions` — `GET` (current user's saved predictions) + `POST` (submit). 401/400/403/200.
`leaderboard` — paginated list. `leaderboard/me` — single user's rank+page.

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
- All predictions submitted upfront before a single tournament-wide lock time (users may resubmit until lock)
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

## Git Commits

- Do not include "Co-Authored-By" lines in commit messages.
