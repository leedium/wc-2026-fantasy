-- Leaderboard RPCs (SECURITY DEFINER) — compute rankings from the scoring CTEs
-- and bypass the predictions RLS so every user can see the full leaderboard.
-- Functions restrict their output to aggregate/public columns only.

create or replace function public.get_leaderboard(
    p_tournament_id uuid,
    p_page int default 1,
    p_page_size int default 25
)
returns table (
    rank int,
    username text,
    points int,
    group_points int,
    knockout_points int,
    total_goals int,
    total_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
    with actual_total_goals as (
        select sum(total_goals)::int as total_goals
        from public.knockout_results
        where tournament_id = p_tournament_id and total_goals is not null
    ),
    group_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                (case when gp.first_team_id = gs.first_team_id then 5 else 0 end)
                + (case when gp.second_team_id = gs.second_team_id then 3 else 0 end)
                + (case when gp.third_team_id = gs.third_team_id then 2 else 0 end)
            ), 0)::int as group_points
        from public.predictions p
        left join public.group_predictions gp on gp.prediction_id = p.id
        left join public.group_standings gs
            on gs.tournament_id = p.tournament_id
            and gs.group_id = gp.group_id
        where p.tournament_id = p_tournament_id
        group by p.id
    ),
    knockout_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(km.point_value), 0)::int as knockout_points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id
        left join public.knockout_results kr
            on kr.tournament_id = p.tournament_id
            and kr.match_id = kp.match_id
        left join public.knockout_matches km on km.id = kp.match_id
        where p.tournament_id = p_tournament_id
          and kp.winner_team_id is not null
          and kr.winner_team_id = kp.winner_team_id
        group by p.id
    ),
    ranked as (
        select
            pr.username::text as username,
            coalesce(gsc.group_points, 0) as group_points,
            coalesce(ksc.knockout_points, 0) as knockout_points,
            (coalesce(gsc.group_points, 0) + coalesce(ksc.knockout_points, 0)) as points,
            p.total_goals,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0) + coalesce(ksc.knockout_points, 0)) desc,
                    case
                        when (select total_goals from actual_total_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select total_goals from actual_total_goals))
                    end asc nulls last,
                    p.submitted_at asc
            )::int as rank
        from public.predictions p
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and p.submitted_at is not null
    )
    select
        rank,
        username,
        points,
        group_points,
        knockout_points,
        total_goals,
        count(*) over () as total_count
    from ranked
    order by rank
    offset greatest(p_page - 1, 0) * greatest(p_page_size, 1)
    limit greatest(p_page_size, 1);
$$;

create or replace function public.get_leaderboard_rank(
    p_tournament_id uuid,
    p_username citext,
    p_page_size int default 25
)
returns table (
    rank int,
    page int,
    points int
)
language sql
security definer
stable
set search_path = public
as $$
    with actual_total_goals as (
        select sum(total_goals)::int as total_goals
        from public.knockout_results
        where tournament_id = p_tournament_id and total_goals is not null
    ),
    group_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                (case when gp.first_team_id = gs.first_team_id then 5 else 0 end)
                + (case when gp.second_team_id = gs.second_team_id then 3 else 0 end)
                + (case when gp.third_team_id = gs.third_team_id then 2 else 0 end)
            ), 0)::int as group_points
        from public.predictions p
        left join public.group_predictions gp on gp.prediction_id = p.id
        left join public.group_standings gs
            on gs.tournament_id = p.tournament_id
            and gs.group_id = gp.group_id
        where p.tournament_id = p_tournament_id
        group by p.id
    ),
    knockout_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(km.point_value), 0)::int as knockout_points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id
        left join public.knockout_results kr
            on kr.tournament_id = p.tournament_id
            and kr.match_id = kp.match_id
        left join public.knockout_matches km on km.id = kp.match_id
        where p.tournament_id = p_tournament_id
          and kp.winner_team_id is not null
          and kr.winner_team_id = kp.winner_team_id
        group by p.id
    ),
    ranked as (
        select
            pr.username,
            (coalesce(gsc.group_points, 0) + coalesce(ksc.knockout_points, 0)) as points,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0) + coalesce(ksc.knockout_points, 0)) desc,
                    case
                        when (select total_goals from actual_total_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select total_goals from actual_total_goals))
                    end asc nulls last,
                    p.submitted_at asc
            )::int as rank
        from public.predictions p
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and p.submitted_at is not null
    )
    select
        rank,
        ((rank - 1) / greatest(p_page_size, 1) + 1)::int as page,
        points
    from ranked
    where username = p_username;
$$;

grant execute on function public.get_leaderboard(uuid, int, int) to anon, authenticated;
grant execute on function public.get_leaderboard_rank(uuid, citext, int) to anon, authenticated;
