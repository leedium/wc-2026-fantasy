-- WC2026 — Scoring v2
--
-- Group stage: set-based scoring of the predicted top-2 against actual top-2.
--     - both correct, exact order   → 6 (8 for Group I "Group of Death")
--     - both correct, swapped order → 4
--     - one correct, in correct slot → 3
--     - one correct, in wrong slot   → 2
--     - else                         → 0
--   Group of Death = 'I' is hardcoded; the 2026 draw is fixed.
--
-- Knockout: per-round, per-advancing-team scoring with a "correct side" bonus.
--   For each team that ACTUALLY advanced from a deciding match, the user gets:
--     - the higher tier if they predicted that exact match's winner correctly,
--     - the lower tier if they predicted that team to win some other match in
--       the same stage (right team, wrong slot),
--     - 0 otherwise.
--   Tiers (correct-side / wrong-side):
--     R16 round  (deciding stage = round_of_32):    5 / 3
--     QF round   (deciding stage = round_of_16):    6 / 3
--     SF round   (deciding stage = quarter_finals): 8 / 4
--     Final round(deciding stage = semi_finals):   10 / 5
--   Plus flat bonuses on top:
--     World Cup champion (M32 winner): +15
--     Third-place match winner (M31):  +5
--
-- Tiebreaker: champion's total tournament goals (admin-entered single number),
--   reusing predictions.total_goals with a relaxed range (0..50).

-- ========== Schema: tiebreaker semantics ==========
alter table public.predictions
    drop constraint if exists predictions_total_goals_check;
alter table public.predictions
    add constraint predictions_total_goals_check
    check (total_goals between 0 and 50);

alter table public.tournaments
    add column if not exists champion_total_goals int
    check (champion_total_goals between 0 and 50);

-- ========== Helper: per-round advancing-team scorer ==========
-- For a given deciding stage (e.g. 'round_of_32' for R16-round advancement),
-- returns each prediction's points for that round under the correct-side /
-- wrong-side / 0 model.
create or replace function public.knockout_round_scores(
    p_tournament_id uuid,
    p_stage text,
    p_correct_pts int,
    p_wrong_pts int
)
returns table (prediction_id uuid, round_points int)
language sql
stable
set search_path = public
as $$
    select
        p.id as prediction_id,
        coalesce(sum(sub.score), 0)::int as round_points
    from public.predictions p
    left join lateral (
        select case
            when kp.winner_team_id = kr.winner_team_id then p_correct_pts
            when exists (
                select 1
                from public.knockout_predictions kp2
                join public.knockout_matches km2 on km2.id = kp2.match_id
                where kp2.prediction_id = p.id
                  and km2.stage = p_stage
                  and kp2.winner_team_id = kr.winner_team_id
            ) then p_wrong_pts
            else 0
        end as score
        from public.knockout_results kr
        join public.knockout_matches km on km.id = kr.match_id
        left join public.knockout_predictions kp
            on kp.prediction_id = p.id and kp.match_id = kr.match_id
        where kr.tournament_id = p.tournament_id
          and km.stage = p_stage
    ) sub on true
    where p.tournament_id = p_tournament_id
    group by p.id;
$$;

-- ========== get_leaderboard (v2) ==========
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
    r16_scores as (select * from public.knockout_round_scores(p_tournament_id, 'round_of_32', 5, 3)),
    qf_scores  as (select * from public.knockout_round_scores(p_tournament_id, 'round_of_16', 6, 3)),
    sf_scores  as (select * from public.knockout_round_scores(p_tournament_id, 'quarter_finals', 8, 4)),
    f_scores   as (select * from public.knockout_round_scores(p_tournament_id, 'semi_finals', 10, 5)),
    champion_score as (
        select
            p.id as prediction_id,
            (case when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id then 15 else 0 end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M32'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M32'
        where p.tournament_id = p_tournament_id
    ),
    third_place_score as (
        select
            p.id as prediction_id,
            (case when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id then 5 else 0 end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M31'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M31'
        where p.tournament_id = p_tournament_id
    ),
    knockout_scores as (
        select
            p.id as prediction_id,
            (coalesce(r16.round_points, 0)
             + coalesce(qf.round_points, 0)
             + coalesce(sf.round_points, 0)
             + coalesce(fs.round_points, 0)
             + coalesce(cs.points, 0)
             + coalesce(tps.points, 0))::int as knockout_points
        from public.predictions p
        left join r16_scores r16 on r16.prediction_id = p.id
        left join qf_scores qf on qf.prediction_id = p.id
        left join sf_scores sf on sf.prediction_id = p.id
        left join f_scores fs on fs.prediction_id = p.id
        left join champion_score cs on cs.prediction_id = p.id
        left join third_place_score tps on tps.prediction_id = p.id
        where p.tournament_id = p_tournament_id
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
                        when (select goals from actual_champion_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select goals from actual_champion_goals))
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

-- ========== get_leaderboard_rank (v2) ==========
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
    r16_scores as (select * from public.knockout_round_scores(p_tournament_id, 'round_of_32', 5, 3)),
    qf_scores  as (select * from public.knockout_round_scores(p_tournament_id, 'round_of_16', 6, 3)),
    sf_scores  as (select * from public.knockout_round_scores(p_tournament_id, 'quarter_finals', 8, 4)),
    f_scores   as (select * from public.knockout_round_scores(p_tournament_id, 'semi_finals', 10, 5)),
    champion_score as (
        select
            p.id as prediction_id,
            (case when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id then 15 else 0 end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M32'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M32'
        where p.tournament_id = p_tournament_id
    ),
    third_place_score as (
        select
            p.id as prediction_id,
            (case when kp.winner_team_id is not null and kp.winner_team_id = kr.winner_team_id then 5 else 0 end)::int as points
        from public.predictions p
        left join public.knockout_predictions kp on kp.prediction_id = p.id and kp.match_id = 'M31'
        left join public.knockout_results kr on kr.tournament_id = p.tournament_id and kr.match_id = 'M31'
        where p.tournament_id = p_tournament_id
    ),
    knockout_scores as (
        select
            p.id as prediction_id,
            (coalesce(r16.round_points, 0)
             + coalesce(qf.round_points, 0)
             + coalesce(sf.round_points, 0)
             + coalesce(fs.round_points, 0)
             + coalesce(cs.points, 0)
             + coalesce(tps.points, 0))::int as knockout_points
        from public.predictions p
        left join r16_scores r16 on r16.prediction_id = p.id
        left join qf_scores qf on qf.prediction_id = p.id
        left join sf_scores sf on sf.prediction_id = p.id
        left join f_scores fs on fs.prediction_id = p.id
        left join champion_score cs on cs.prediction_id = p.id
        left join third_place_score tps on tps.prediction_id = p.id
        where p.tournament_id = p_tournament_id
    ),
    ranked as (
        select
            pr.username,
            (coalesce(gsc.group_points, 0) + coalesce(ksc.knockout_points, 0)) as points,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0) + coalesce(ksc.knockout_points, 0)) desc,
                    case
                        when (select goals from actual_champion_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select goals from actual_champion_goals))
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
