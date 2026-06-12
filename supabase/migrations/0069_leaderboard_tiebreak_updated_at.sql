-- 0069_leaderboard_tiebreak_updated_at.sql
--
-- Switch the leaderboard's time-based tiebreaker from `submitted_at` to
-- `updated_at`. Ranking order is unchanged otherwise:
--   1. total points DESC
--   2. goal-closeness ASC (abs(total_goals - champion_total_goals), nulls last)
--   3. TIME ASC  <-- this line changes: submitted_at -> updated_at
--
-- `submitted_at` re-stamps on every explicit submit (incl. phase-2 goal edits),
-- which would reset the time tiebreaker once phase 2 opens. Pre-results the goal
-- tiebreaker is NULL, so the time column decides ties; `updated_at` is used here
-- for now. `submitted_at` semantics are left untouched (last submit is still the
-- qualifier) and will be revisited when phase 2 begins.
--
-- Both ranking RPCs change together so the "find me" rank (get_leaderboard_rank)
-- stays consistent with the displayed rank (get_leaderboard); a mismatch would
-- send "find me" to the wrong page.
--
-- Bodies are re-emitted verbatim from the latest versions — get_leaderboard from
-- 0068 (search filter), get_leaderboard_rank from 0054 (10/7/5/2 group scoring) —
-- with only the ORDER BY time column changed. The admin_get_leaderboard wrapper
-- (0068) is unchanged; it calls get_leaderboard and inherits the new ordering.

-- ========== get_leaderboard (re-emitted from 0068) ==========

create or replace function public.get_leaderboard(
    p_tournament_id uuid,
    p_page int default 1,
    p_page_size int default 25,
    p_search text default null
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
    updated_at timestamptz,
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
    search_term as (
        select nullif(trim(coalesce(p_search, '')), '') as q
    ),
    group_scores as (
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
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M104'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M104'
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
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M103'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M103'
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
            on kr.tournament_id = p.tournament_id and kr.match_id = 'M104'
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
            p.updated_at as updated_at,
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
                    p.updated_at asc nulls last
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
        updated_at,
        count(*) over () as total_count
    from ranked, search_term
    where search_term.q is null
       or ranked.username ilike '%' || search_term.q || '%'
       or ranked.prediction_name ilike '%' || search_term.q || '%'
    order by rank
    offset greatest(p_page - 1, 0) * greatest(p_page_size, 1)
    limit greatest(p_page_size, 1);
$$;

grant execute on function public.get_leaderboard(uuid, int, int, text) to anon, authenticated;

-- ========== get_leaderboard_rank (re-emitted from 0054) ==========

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
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M104'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M104'
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
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M103'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M103'
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
            on kr.tournament_id = p.tournament_id and kr.match_id = 'M104'
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
                    p.updated_at asc nulls last
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
