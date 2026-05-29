# WC2026 Prediction Game

A web app for predicting the 2026 FIFA World Cup. Players register, submit a full bracket (group standings + knockout winners + total-goals tiebreaker) before a single lock time, and earn points based on how close their predictions match the real results. A live leaderboard ranks every participant.

Built with Next.js 16 (App Router, SSR) and Supabase (Postgres + Auth), deployable to Cloudflare Workers via `@opennextjs/cloudflare`.

## Stack

| Layer       | Choice                                                       |
| ----------- | ------------------------------------------------------------ |
| Frontend    | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui (Radix)      |
| State       | Zustand 5 (UI), TanStack React Query 5 (server data)         |
| Auth + DB   | Supabase (Postgres, RLS, Auth) via `@supabase/ssr`           |
| Deploy      | Cloudflare Workers via `@opennextjs/cloudflare` + `wrangler` |
| Testing     | Jest 29, React Testing Library 16                            |

## Repository layout

```
WC2026/
├── frontend/            Next.js app (UI + API routes)
│   ├── src/
│   │   ├── app/         Pages, layouts, route handlers
│   │   ├── components/  layout, predictions, leaderboard, shared, ui
│   │   ├── lib/supabase Browser / server / admin clients
│   │   ├── providers/   AuthProvider, QueryProvider, ThemeProvider
│   │   ├── stores/      Zustand store (UI state only)
│   │   └── middleware.ts
│   └── wrangler.toml
├── supabase/
│   ├── migrations/      0001 schema, 0002 RLS, 0003 triggers/RPCs, 0004 leaderboard RPCs
│   ├── seed.sql         12 groups, 48 teams, 31 knockout matches, 1 active tournament
│   └── config.toml
├── CLAUDE.md            Guidance for Claude Code agents
├── ENGINEERING.md
└── PRD.md
```

## Prerequisites

- Node.js 20+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local Postgres + Auth)
- Docker (required by the Supabase CLI)

## Quick start

```bash
# 1. Start Supabase locally (Postgres + Auth + Studio at localhost:54323)
supabase start

# 2. Apply migrations + seed
supabase db reset

# 3. Frontend
cd frontend
cp .env.example .env.local           # fill in the Supabase URL + keys printed by `supabase start`
npm install
npm run dev                           # http://localhost:3000
```

Required env vars (see `frontend/.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Git hooks (one-time, per clone)

This repo ships a tracked `pre-push` hook that blocks accidental direct pushes to `main`
(all changes go through a PR). Git hooks aren't enabled automatically on clone — activate
them once with:

```bash
git config core.hooksPath .githooks
```

Bypass intentionally with `git push --no-verify`. `main` is also protected server-side on
GitHub, so this is just for faster local feedback.

## Frontend scripts

Run from `frontend/`:

| Script                    | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Next.js dev server                                         |
| `npm run build`           | Production build                                           |
| `npm run start`           | Start production build locally                             |
| `npm run typecheck`       | `tsc --noEmit`                                             |
| `npm run lint`            | ESLint                                                     |
| `npm run format`          | Prettier write                                             |
| `npm test`                | Jest                                                       |
| `npm run test:watch`      | Jest watch mode                                            |
| `npm run test:coverage`   | Jest with coverage                                         |
| `npm run preview`         | OpenNext build + local Cloudflare Workers preview          |
| `npm run deploy`          | OpenNext build + deploy to Cloudflare Workers              |

## Database

Schema, policies, triggers, and RPCs live in `supabase/migrations/`. To rebuild from scratch:

```bash
supabase db reset
```

Key entities:

- `profiles` — username + admin flag, 1:1 with `auth.users`
- `tournaments` — single active row, holds `lock_time`
- `groups` (12), `teams` (48), `knockout_matches` (31)
- `predictions` + `group_predictions` + `knockout_predictions` — user submissions
- `group_standings`, `knockout_results` — admin-submitted truth

The trust boundary is the `submit_predictions(jsonb)` RPC: it validates that every team belongs to the claimed group, enforces the lock time, and runs the upsert in a single transaction. The leaderboard goes through two SECURITY DEFINER RPCs (`get_leaderboard`, `get_leaderboard_rank`) so it can read across users without violating the RLS policy on `predictions`.

## Auth

Email + password via Supabase Auth. Username is collected at signup and stored in `profiles` by the `handle_new_user` trigger. The trigger raises `'username taken'` (errcode `P0001`) on collision and `'username invalid format'` on format violations; `RegisterForm` branches on these strings.

`middleware.ts` protects `/predictions` — unauthenticated requests are redirected to `/login?next=/predictions`.

## Game mechanics

- 48 teams in 12 groups (A–L), 31 knockout matches (R32 → Final)
- All predictions submitted upfront before the tournament-wide lock; users may resubmit until lock
- Group stage scoring: `+5` for correct 1st, `+3` for 2nd, `+2` for 3rd, 0 for 4th
- Knockout scoring: `point_value` per match (defined in seed)
- Tiebreaker: predicted total tournament goals (closest wins)

## Testing

```bash
cd frontend
npm test                  # full suite
npm run test:coverage     # with coverage report
```

Tests cover the Zustand store, prediction forms, leaderboard table, layout components, login/register forms, the auth middleware, the `/api/predictions` and `/api/leaderboard` route handlers, and the `AuthProvider`. API route and middleware tests use the `node` Jest environment (declared via `/** @jest-environment node */` docblock); component tests use `jsdom`.

## Deployment

Production runs on Cloudflare Workers via `@opennextjs/cloudflare`. To smoke-test the Worker runtime locally before shipping:

```bash
cd frontend
npm run preview
```

Set the same Supabase env vars in your Cloudflare project (or `wrangler.toml` `[vars]`). `nodejs_compat` is already enabled in `wrangler.toml`.

## Documentation

- `CLAUDE.md` — guidance for Claude Code agents working in the repo
- `PRD.md` — product requirements
- `ENGINEERING.md` — engineering notes
