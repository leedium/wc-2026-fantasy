-- Advancers v2: replace the FIFA-bracket-coupled "bundle" model with a
-- flat ranked top-8 list of 3rd-place teams.
--
-- The earlier model (0020) coupled 8 bundle slots to specific R32 matches
-- with 5-group whitelists. This was faithful to FIFA's bracket but hard
-- to explain to users and tightly bound to a bracket layout that won't
-- be public until after group stage.
--
-- New model:
--   * Users pick 8 teams in descending order of "best 3rd-place team",
--     drawn from their own 12 predicted 3rd-place teams.
--   * Admins set the actual top-8 ranked advancers (drawn from the real
--     3rd-place finishers per admin-entered group_standings).
--   * R32 bracket assignment (which advancer fills which 3rd-place R32
--     slot per FIFA's published bracket) lives in 0026.
--
-- This migration drops the bundle schema and adds the replacement tables.
-- The RPCs that referenced the dropped tables (submit_predictions,
-- admin_submit_predictions, admin_set_third_place_advancer, get_leaderboard,
-- get_leaderboard_rank) are redefined in 0027 and 0028. Between 0025 and
-- those migrations the old function definitions still exist but reference
-- dropped tables; nothing calls them during migration.
--
-- The R32 team_source strings ('3-ABCDF' etc.) on knockout_matches stay
-- in place but are now decorative — the resolver looks at
-- r32_bracket_assignments (0026) instead.

-- ========== drop the bundle schema ==========

drop function if exists public.admin_set_third_place_advancer(uuid, int, text);
drop function if exists public.admin_clear_third_place_advancer(uuid, int);

drop table if exists public.third_place_bundle_predictions;
drop table if exists public.tournament_third_place_advancers;
drop table if exists public.third_place_bundles;

-- ========== advancer_predictions ==========
-- Per-prediction ranked list of 8 teams. team_id must reference a team
-- the user picked as 3rd-place in their group_predictions for the same
-- prediction; this is enforced in the submit_predictions RPC (0027) rather
-- than via a constraint, because group_predictions writes happen in the
-- same transaction.

create table public.advancer_predictions (
    prediction_id uuid not null references public.predictions(id) on delete cascade,
    rank int not null check (rank between 1 and 8),
    team_id text not null references public.teams(id),
    primary key (prediction_id, rank),
    unique (prediction_id, team_id)
);

create index advancer_predictions_prediction_idx
    on public.advancer_predictions (prediction_id);

alter table public.advancer_predictions enable row level security;

create policy "advancer_predictions_select_own_or_admin"
    on public.advancer_predictions for select
    using (
        public.is_admin()
        or exists (
            select 1 from public.predictions p
            where p.id = advancer_predictions.prediction_id
              and p.user_id = auth.uid()
        )
    );

-- Writes only via submit_predictions / admin_submit_predictions (the RPCs
-- run security invoker + security definer respectively; both are admin
-- gated or user-scoped). Block direct inserts from the authenticated role.
create policy "advancer_predictions_no_direct_write"
    on public.advancer_predictions for all
    using (public.is_admin())
    with check (public.is_admin());

grant select on public.advancer_predictions to authenticated;

-- ========== tournament_advancers ==========
-- Admin-entered ranked top-8 advancers per tournament. team_id is the
-- actual team that finished 3rd in its group and was selected as one of
-- the 8 best 3rd-placers. Used by the scoring CTE (0028) and as the
-- candidate pool for r32_bracket_assignments (0026).

create table public.tournament_advancers (
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    rank int not null check (rank between 1 and 8),
    team_id text not null references public.teams(id),
    primary key (tournament_id, rank),
    unique (tournament_id, team_id)
);

alter table public.tournament_advancers enable row level security;

create policy "tournament_advancers_select_all"
    on public.tournament_advancers for select
    using (true);

create policy "tournament_advancers_admin_write"
    on public.tournament_advancers for all
    using (public.is_admin())
    with check (public.is_admin());

grant select on public.tournament_advancers to anon, authenticated;
grant insert, update, delete on public.tournament_advancers to authenticated;
