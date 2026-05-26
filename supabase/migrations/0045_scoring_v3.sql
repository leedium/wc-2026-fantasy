-- 0045_scoring_v3.sql
--
-- Knockout scoring v3: relabel rounds by what you predict (R32/R16/QF/SF)
-- instead of what they advance to, rebalance point values to reward deeper
-- correct picks more evenly, and lift the tiebreaker CHECK constraint from
-- 0..50 to 0..200.
--
-- New point values (max knockout = 200, unchanged):
--   R32 (16 matches):  4 correct / 3 wrong-side
--   R16 ( 8 matches):  6 correct / 4 wrong-side
--   QF  ( 4 matches): 10 correct / 6 wrong-side
--   SF  ( 2 matches): 14 correct / 9 wrong-side
--   M31 (3rd place):   5
--   M32 (champion):   15
--   Gut-feeling pick:  5 (unchanged)
--
-- Values move into IMMUTABLE config functions so future tweaks only need
-- a single `create or replace` of the config, not the full RPC body.
-- The `knockout_round_scores` helper from 0006 is reused as-is.

-- ========== scoring config (single source of truth) ==========

create or replace function public.knockout_round_config()
returns table(stage text, correct_pts int, wrong_pts int)
language sql
immutable
parallel safe
set search_path = public
as $$
    values
        ('round_of_32',    4, 3),
        ('round_of_16',    6, 4),
        ('quarter_finals', 10, 6),
        ('semi_finals',    14, 9)
$$;

create or replace function public.scoring_third_place_pts()
returns int
language sql
immutable
parallel safe
set search_path = public
as $$ select 5 $$;

create or replace function public.scoring_champion_pts()
returns int
language sql
immutable
parallel safe
set search_path = public
as $$ select 15 $$;

create or replace function public.scoring_champion_pick_pts()
returns int
language sql
immutable
parallel safe
set search_path = public
as $$ select 5 $$;

grant execute on function public.knockout_round_config() to anon, authenticated;
grant execute on function public.scoring_third_place_pts() to anon, authenticated;
grant execute on function public.scoring_champion_pts() to anon, authenticated;
grant execute on function public.scoring_champion_pick_pts() to anon, authenticated;

-- ========== get_leaderboard (v3) ==========
-- Same signature + return columns as 0036. Replaces the 4 hardcoded
-- knockout_round_scores() calls with a single lateral over the config,
-- and reads the M31 / M32 / gut-feeling bonuses from the config functions.

create or replace function public.get_leaderboard(
    p_tournament_id uuid,
    p_page int default 1,
    p_page_size int default 25
)
returns table (
    rank int,
    prediction_id uuid,
    prediction_name text,
    username text,
    points numeric,
    group_points int,
    advancer_points numeric,
    knockout_points int,
    champion_pick_points int,
    total_goals int,
    total_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
    with actual_champion_goals as (
        select champion_total_goals as goals
        from public.tournaments
        where id = p_tournament_id
    ),
    group_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when gp.first_team_id = gs.first_team_id and gp.second_team_id = gs.second_team_id
                        then case when gp.group_id = 'I' then 8 else 6 end
                    when gp.first_team_id = gs.second_team_id and gp.second_team_id = gs.first_team_id
                        then 4
                    when gp.first_team_id = gs.first_team_id or gp.second_team_id = gs.second_team_id
                        then 3
                    when gp.first_team_id = gs.second_team_id or gp.second_team_id = gs.first_team_id
                        then 2
                    else 0
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
                    when ta_rank.team_id is not null and ta_rank.team_id = ap.team_id then 1.25
                    when ta_team.team_id is not null then 1.0
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
    knockout_round_totals as (
        select s.prediction_id, coalesce(sum(s.round_points), 0)::int as round_points
        from public.knockout_round_config() c
        cross join lateral public.knockout_round_scores(
            p_tournament_id, c.stage, c.correct_pts, c.wrong_pts
        ) s
        group by s.prediction_id
    ),
    champion_score as (
        select
            p.id as prediction_id,
            (case
                when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id
                    then public.scoring_champion_pts()
                else 0
            end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M32'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M32'
        where p.tournament_id = p_tournament_id
    ),
    third_place_score as (
        select
            p.id as prediction_id,
            (case
                when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id
                    then public.scoring_third_place_pts()
                else 0
            end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M31'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M31'
        where p.tournament_id = p_tournament_id
    ),
    champion_pick_score as (
        select
            p.id as prediction_id,
            (case
                when p.champion_team_id is not null and p.champion_team_id = kr.winner_team_id
                    then public.scoring_champion_pick_pts()
                else 0
            end)::int as points
        from public.predictions p
        left join public.knockout_results kr
            on kr.tournament_id = p.tournament_id and kr.match_id = 'M32'
        where p.tournament_id = p_tournament_id
    ),
    knockout_scores as (
        select
            p.id as prediction_id,
            (coalesce(krt.round_points, 0)
             + coalesce(cs.points, 0)
             + coalesce(tps.points, 0))::int as knockout_points,
            coalesce(cps.points, 0)::int as champion_pick_points
        from public.predictions p
        left join knockout_round_totals krt on krt.prediction_id = p.id
        left join champion_score cs on cs.prediction_id = p.id
        left join third_place_score tps on tps.prediction_id = p.id
        left join champion_pick_score cps on cps.prediction_id = p.id
        where p.tournament_id = p_tournament_id
    ),
    ranked as (
        select
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
            pr.username::text as username,
            coalesce(gsc.group_points, 0) as group_points,
            coalesce(asc_.advancer_points, 0)::numeric as advancer_points,
            coalesce(ksc.knockout_points, 0) as knockout_points,
            coalesce(ksc.champion_pick_points, 0) as champion_pick_points,
            (coalesce(gsc.group_points, 0)
                + coalesce(asc_.advancer_points, 0)
                + coalesce(ksc.knockout_points, 0)
                + coalesce(ksc.champion_pick_points, 0))::numeric as points,
            p.total_goals,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(asc_.advancer_points, 0)
                        + coalesce(ksc.knockout_points, 0)
                        + coalesce(ksc.champion_pick_points, 0)) desc,
                    case
                        when (select goals from actual_champion_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select goals from actual_champion_goals))
                    end asc nulls last,
                    p.submitted_at asc nulls last
            )::int as rank
        from public.predictions p
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join advancer_scores asc_ on asc_.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and (p.submitted_at is not null or public.prediction_phase1_complete(p.id))
          and exists (
              select 1
              from public.tournament_payments tp
              join public.tournaments t on t.id = tp.tournament_id
              where tp.prediction_id = p.id
                and tp.paid_at <= t.lock_time
          )
    )
    select
        rank,
        prediction_id,
        prediction_name,
        username,
        points,
        group_points,
        advancer_points,
        knockout_points,
        champion_pick_points,
        total_goals,
        count(*) over () as total_count
    from ranked
    order by rank
    offset greatest(p_page - 1, 0) * greatest(p_page_size, 1)
    limit greatest(p_page_size, 1);
$$;

grant execute on function public.get_leaderboard(uuid, int, int) to anon, authenticated;

-- ========== get_leaderboard_rank (v3) ==========

create or replace function public.get_leaderboard_rank(
    p_tournament_id uuid,
    p_user_id uuid,
    p_page_size int default 25
)
returns table (
    prediction_id uuid,
    prediction_name text,
    rank int,
    page int,
    points numeric
)
language sql
security definer
stable
set search_path = public
as $$
    with actual_champion_goals as (
        select champion_total_goals as goals
        from public.tournaments
        where id = p_tournament_id
    ),
    group_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when gp.first_team_id = gs.first_team_id and gp.second_team_id = gs.second_team_id
                        then case when gp.group_id = 'I' then 8 else 6 end
                    when gp.first_team_id = gs.second_team_id and gp.second_team_id = gs.first_team_id
                        then 4
                    when gp.first_team_id = gs.first_team_id or gp.second_team_id = gs.second_team_id
                        then 3
                    when gp.first_team_id = gs.second_team_id or gp.second_team_id = gs.first_team_id
                        then 2
                    else 0
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
                    when ta_rank.team_id is not null and ta_rank.team_id = ap.team_id then 1.25
                    when ta_team.team_id is not null then 1.0
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
    knockout_round_totals as (
        select s.prediction_id, coalesce(sum(s.round_points), 0)::int as round_points
        from public.knockout_round_config() c
        cross join lateral public.knockout_round_scores(
            p_tournament_id, c.stage, c.correct_pts, c.wrong_pts
        ) s
        group by s.prediction_id
    ),
    champion_score as (
        select
            p.id as prediction_id,
            (case
                when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id
                    then public.scoring_champion_pts()
                else 0
            end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M32'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M32'
        where p.tournament_id = p_tournament_id
    ),
    third_place_score as (
        select
            p.id as prediction_id,
            (case
                when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id
                    then public.scoring_third_place_pts()
                else 0
            end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M31'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M31'
        where p.tournament_id = p_tournament_id
    ),
    champion_pick_score as (
        select
            p.id as prediction_id,
            (case
                when p.champion_team_id is not null and p.champion_team_id = kr.winner_team_id
                    then public.scoring_champion_pick_pts()
                else 0
            end)::int as points
        from public.predictions p
        left join public.knockout_results kr
            on kr.tournament_id = p.tournament_id and kr.match_id = 'M32'
        where p.tournament_id = p_tournament_id
    ),
    knockout_scores as (
        select
            p.id as prediction_id,
            (coalesce(krt.round_points, 0)
             + coalesce(cs.points, 0)
             + coalesce(tps.points, 0))::int as knockout_points,
            coalesce(cps.points, 0)::int as champion_pick_points
        from public.predictions p
        left join knockout_round_totals krt on krt.prediction_id = p.id
        left join champion_score cs on cs.prediction_id = p.id
        left join third_place_score tps on tps.prediction_id = p.id
        left join champion_pick_score cps on cps.prediction_id = p.id
        where p.tournament_id = p_tournament_id
    ),
    ranked as (
        select
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
            p.user_id,
            (coalesce(gsc.group_points, 0)
                + coalesce(asc_.advancer_points, 0)
                + coalesce(ksc.knockout_points, 0)
                + coalesce(ksc.champion_pick_points, 0))::numeric as points,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(asc_.advancer_points, 0)
                        + coalesce(ksc.knockout_points, 0)
                        + coalesce(ksc.champion_pick_points, 0)) desc,
                    case
                        when (select goals from actual_champion_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select goals from actual_champion_goals))
                    end asc nulls last,
                    p.submitted_at asc nulls last
            )::int as rank
        from public.predictions p
        left join group_scores gsc on gsc.prediction_id = p.id
        left join advancer_scores asc_ on asc_.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and (p.submitted_at is not null or public.prediction_phase1_complete(p.id))
          and exists (
              select 1
              from public.tournament_payments tp
              join public.tournaments t on t.id = tp.tournament_id
              where tp.prediction_id = p.id
                and tp.paid_at <= t.lock_time
          )
    )
    select
        prediction_id,
        prediction_name,
        rank,
        ((rank - 1) / greatest(p_page_size, 1) + 1)::int as page,
        points
    from ranked
    where user_id = p_user_id
    order by rank;
$$;

grant execute on function public.get_leaderboard_rank(uuid, uuid, int) to anon, authenticated;

-- ========== relax tiebreaker CHECK constraints (0..50 -> 0..200) ==========

alter table public.predictions
    drop constraint if exists predictions_total_goals_check;
alter table public.predictions
    add constraint predictions_total_goals_check
    check (total_goals is null or total_goals between 0 and 200);

alter table public.tournaments
    drop constraint if exists tournaments_champion_total_goals_check;
alter table public.tournaments
    add constraint tournaments_champion_total_goals_check
    check (champion_total_goals is null or champion_total_goals between 0 and 200);
