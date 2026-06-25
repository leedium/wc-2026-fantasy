-- 0070_phase1_winners_snapshot.sql
--
-- Snapshot the Phase 1 (group-stage + Best-3rds advancers) top 3 at the moment
-- Phase 2 opens, freezing the standings that decide the separate Phase 1 prize.
-- Once Phase 2 starts, the live leaderboard folds in knockout points, so the
-- Phase 1 result is no longer visible as a standalone ranking; this persists it.
--
-- Phase 1 score = group_points + advancer_points ONLY. The Champion-Pick bonus is
-- intentionally excluded — it resolves from the final (M104) result, which isn't
-- known at Phase 2 open, so it contributes 0 and is not a Phase 1 prize component.
--
-- Tiebreaker: points DESC, then earliest predictions.updated_at. No goal-closeness
-- tiebreaker — the champion's total goals aren't known yet and are irrelevant to
-- Phase 1 (it's a Phase 2 / end-of-tournament tiebreaker).
--
-- Eligibility matches the leaderboard: Phase 1 complete AND paid before lock. The
-- group_scores / advancer_scores CTEs and the eligibility predicate are lifted
-- verbatim from get_leaderboard (0069_leaderboard_tiebreak_updated_at.sql).

-- ========== snapshot table ==========

create table if not exists public.phase1_winners (
    tournament_id         uuid not null references public.tournaments(id) on delete cascade,
    rank                  int  not null,
    prediction_id         uuid not null references public.predictions(id) on delete cascade,
    prediction_name       text not null,
    username              text not null,
    group_points          int  not null,
    advancer_points       numeric not null,
    phase1_points         numeric not null,
    prediction_updated_at timestamptz,                       -- frozen tiebreaker source (display/audit)
    snapshotted_at        timestamptz not null default now(),
    primary key (tournament_id, rank)
);

alter table public.phase1_winners enable row level security;

-- Public, non-sensitive (username + points, curated to 3 rows) — readable by the
-- public leaderboard / prizes pages. No write policy: writes only happen via the
-- SECURITY DEFINER RPC below.
drop policy if exists phase1_winners_select_all on public.phase1_winners;
create policy phase1_winners_select_all
    on public.phase1_winners
    for select
    to anon, authenticated
    using (true);

-- ========== admin_snapshot_phase1_winners ==========

create or replace function public.admin_snapshot_phase1_winners(p_tournament_id uuid)
returns setof public.phase1_winners
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden';
    end if;

    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found';
    end if;

    delete from public.phase1_winners where tournament_id = p_tournament_id;

    return query
    with group_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when gp.first_team_id = gs.first_team_id and gp.second_team_id = gs.second_team_id
                        then case when gp.group_id = 'I' then 15 else 10 end
                    when gp.first_team_id = gs.second_team_id and gp.second_team_id = gs.first_team_id
                        then 7
                    else
                        case
                            when gp.first_team_id = gs.first_team_id then 5   -- single team, correct slot
                            when gp.second_team_id = gs.second_team_id then 5 -- single team, correct slot
                            when gp.first_team_id = gs.second_team_id then 2  -- single team, wrong slot
                            when gp.second_team_id = gs.first_team_id then 2  -- single team, wrong slot
                            else 0
                        end
                end
            ), 0)::int as group_points
        from public.predictions p
        left join public.group_predictions gp on gp.prediction_id = p.id
        left join public.group_standings gs
            on gs.tournament_id = p.tournament_id
            and gs.group_id = gp.group_id
        where p.tournament_id = p_tournament_id
        group by p.id
    ),
    advancer_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when ta_rank.team_id is not null and ta_rank.team_id = ap.team_id then 2.5
                    when ta_team.team_id is not null then 2.0
                    else 0
                end
            ), 0)::numeric as advancer_points
        from public.predictions p
        left join public.advancer_predictions ap on ap.prediction_id = p.id
        left join public.tournament_advancers ta_rank
            on ta_rank.tournament_id = p.tournament_id
            and ta_rank.rank = ap.rank
        left join public.tournament_advancers ta_team
            on ta_team.tournament_id = p.tournament_id
            and ta_team.team_id = ap.team_id
        where p.tournament_id = p_tournament_id
        group by p.id
    ),
    ranked as (
        select
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
            pr.username::text as username,
            coalesce(gsc.group_points, 0) as group_points,
            coalesce(asc_.advancer_points, 0)::numeric as advancer_points,
            (coalesce(gsc.group_points, 0)
                + coalesce(asc_.advancer_points, 0))::numeric as phase1_points,
            p.updated_at as prediction_updated_at,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(asc_.advancer_points, 0)) desc,
                    p.updated_at asc nulls last
            )::int as rank
        from public.predictions p
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join advancer_scores asc_ on asc_.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and (p.submitted_at is not null or public.prediction_phase1_complete(p.id))
          and exists (
              select 1
              from public.tournament_payments tp
              join public.tournaments t on t.id = tp.tournament_id
              where tp.prediction_id = p.id
                and tp.paid_at <= t.lock_time
          )
    ),
    inserted as (
        insert into public.phase1_winners (
            tournament_id, rank, prediction_id, prediction_name, username,
            group_points, advancer_points, phase1_points, prediction_updated_at
        )
        select
            p_tournament_id, r.rank, r.prediction_id, r.prediction_name, r.username,
            r.group_points, r.advancer_points, r.phase1_points, r.prediction_updated_at
        from ranked r
        where r.rank <= 3
        returning *
    )
    select * from inserted order by rank;
end;
$$;

grant execute on function public.admin_snapshot_phase1_winners(uuid) to authenticated;
