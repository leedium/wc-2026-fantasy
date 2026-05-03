-- WC2026 Prediction Game — Initial Schema
-- Tables: profiles, tournaments, groups, teams, knockout_matches,
--         predictions, group_predictions, knockout_predictions,
--         group_standings, knockout_results.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

--
-- profiles: 1:1 with auth.users
--
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username citext not null unique,
    display_name text,
    avatar_url text,
    is_admin boolean not null default false,
    created_at timestamptz not null default now(),
    constraint profiles_username_format check (
        length(username::text) between 3 and 24
        and username::text ~ '^[a-zA-Z0-9_]+$'
    )
);

create index profiles_username_idx on public.profiles (username);

--
-- tournaments
--
create table public.tournaments (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    status text not null default 'upcoming' check (status in ('upcoming','group_stage','knockout','completed')),
    lock_time timestamptz not null,
    total_entries int not null default 0,
    is_active boolean not null default false,
    created_at timestamptz not null default now()
);

-- Only one active tournament at a time
create unique index tournaments_single_active_idx on public.tournaments (is_active) where is_active;

--
-- groups (12 rows)
--
create table public.groups (
    id text primary key check (id ~ '^[A-L]$'),
    name text not null
);

--
-- teams (48 rows)
--
create table public.teams (
    id text primary key,
    name text not null,
    code char(3) not null unique,
    group_id text not null references public.groups(id)
);

create index teams_group_idx on public.teams (group_id);

--
-- knockout_matches (31 rows — tournament-agnostic bracket metadata)
--
create table public.knockout_matches (
    id text primary key,
    stage text not null check (stage in ('round_of_32','round_of_16','quarter_finals','semi_finals','third_place','final')),
    team1_source text not null,
    team2_source text not null,
    point_value int not null,
    match_order int not null
);

create index knockout_matches_stage_idx on public.knockout_matches (stage, match_order);

--
-- predictions: one per (user, tournament) — holds tiebreaker + submission timestamp
--
create table public.predictions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    total_goals int check (total_goals between 100 and 300),
    submitted_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (user_id, tournament_id)
);

create index predictions_user_idx on public.predictions (user_id);
create index predictions_tournament_idx on public.predictions (tournament_id);

--
-- group_predictions (12 per prediction)
--
create table public.group_predictions (
    prediction_id uuid not null references public.predictions(id) on delete cascade,
    group_id text not null references public.groups(id),
    first_team_id text references public.teams(id),
    second_team_id text references public.teams(id),
    third_team_id text references public.teams(id),
    fourth_team_id text references public.teams(id),
    primary key (prediction_id, group_id),
    constraint group_predictions_distinct check (
        (first_team_id is null and second_team_id is null and third_team_id is null and fourth_team_id is null)
        or (
            first_team_id is distinct from second_team_id
            and first_team_id is distinct from third_team_id
            and first_team_id is distinct from fourth_team_id
            and second_team_id is distinct from third_team_id
            and second_team_id is distinct from fourth_team_id
            and third_team_id is distinct from fourth_team_id
        )
    )
);

--
-- knockout_predictions (31 per prediction)
--
create table public.knockout_predictions (
    prediction_id uuid not null references public.predictions(id) on delete cascade,
    match_id text not null references public.knockout_matches(id),
    winner_team_id text references public.teams(id),
    primary key (prediction_id, match_id)
);

--
-- group_standings (admin-submitted actuals, 12 per tournament)
--
create table public.group_standings (
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    group_id text not null references public.groups(id),
    first_team_id text not null references public.teams(id),
    second_team_id text not null references public.teams(id),
    third_team_id text not null references public.teams(id),
    fourth_team_id text not null references public.teams(id),
    submitted_at timestamptz not null default now(),
    primary key (tournament_id, group_id)
);

--
-- knockout_results (admin-submitted actuals, 31 per tournament)
--
create table public.knockout_results (
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    match_id text not null references public.knockout_matches(id),
    winner_team_id text not null references public.teams(id),
    loser_team_id text not null references public.teams(id),
    total_goals int,
    submitted_at timestamptz not null default now(),
    primary key (tournament_id, match_id)
);

--
-- Trigger: maintain predictions.updated_at
--
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger predictions_touch_updated_at
before update on public.predictions
for each row execute function public.touch_updated_at();
