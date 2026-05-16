-- Phase 1 complete drafts count for the leaderboard.
--
-- Bug: a user who finishes group + best-3rds picks in Phase 1 and clicks
-- "Save Phase 1 Picks" creates a row with submitted_at = null. The full
-- "Submit Prediction" button is gated on the bracket + tiebreaker being
-- complete (Phase 2 fields), which Phase 1 users can't fill, and once
-- Phase 1 locks the RPC refuses any further writes. The leaderboard +
-- per-user rank + public bracket preview RPCs all filter on
-- `submitted_at is not null`, so the user's paid, Phase-1-complete
-- prediction is silently excluded for the rest of the tournament.
--
-- Fix: treat a prediction as eligible if it is either explicitly
-- submitted OR has a complete Phase 1 pick set (12 group rows + 8
-- advancer rows). Backfill submitted_at on existing complete drafts in
-- tournaments past phase1 so the ORDER BY tiebreaker (submitted_at asc)
-- has a stable value.
--
-- All three RPCs are re-defined from 0031 / 0029 with the relaxed WHERE
-- clause; everything else (scoring math, payment gate, columns) is
-- unchanged.

-- ========== helper: prediction_phase1_complete ==========
-- Returns true iff the prediction has all 12 group picks and 8 advancer
-- rows. STABLE so callers can inline it in WHERE clauses.

create or replace function public.prediction_phase1_complete(p_prediction_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
    select
        (select count(*) from public.group_predictions where prediction_id = p_prediction_id) = 12
        and (select count(*) from public.advancer_predictions where prediction_id = p_prediction_id) = 8;
$$;

grant execute on function public.prediction_phase1_complete(uuid) to anon, authenticated;

-- ========== backfill ==========
-- Stamp submitted_at on every complete-Phase-1 draft whose tournament is
-- past phase 1 (locked / phase 2 / completed). New predictions stay
-- unstamped until either (a) the user / admin explicitly submits or
-- (b) the relaxed filter below picks them up after the lock flips.

update public.predictions p
   set submitted_at = now()
 where p.submitted_at is null
   and public.tournament_phase(p.tournament_id) <> 'phase1'
   and public.prediction_phase1_complete(p.id);

-- ========== get_leaderboard ==========

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
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
            pr.username::text as username,
            coalesce(gsc.group_points, 0) as group_points,
            coalesce(asc_.advancer_points, 0)::numeric as advancer_points,
            coalesce(ksc.knockout_points, 0) as knockout_points,
            (coalesce(gsc.group_points, 0)
                + coalesce(asc_.advancer_points, 0)
                + coalesce(ksc.knockout_points, 0))::numeric as points,
            p.total_goals,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(asc_.advancer_points, 0)
                        + coalesce(ksc.knockout_points, 0)) desc,
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
        total_goals,
        count(*) over () as total_count
    from ranked
    order by rank
    offset greatest(p_page - 1, 0) * greatest(p_page_size, 1)
    limit greatest(p_page_size, 1);
$$;

-- ========== get_leaderboard_rank ==========

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
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
            p.user_id,
            (coalesce(gsc.group_points, 0)
                + coalesce(asc_.advancer_points, 0)
                + coalesce(ksc.knockout_points, 0))::numeric as points,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(asc_.advancer_points, 0)
                        + coalesce(ksc.knockout_points, 0)) desc,
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

-- ========== get_public_prediction ==========
-- Mirrors the relaxed eligibility filter so the leaderboard → bracket
-- detail click-through doesn't 404 on Phase-1-complete drafts.

create or replace function public.get_public_prediction(p_prediction_id uuid)
returns table (
    prediction_id uuid,
    prediction_name text,
    username text,
    total_goals int,
    submitted_at timestamptz,
    groups jsonb,
    knockout jsonb,
    advancers jsonb
)
language sql
security definer
stable
set search_path = public
as $$
    with elig as (
        select p.id, p.user_id, p.tournament_id, p.prediction_name, p.total_goals, p.submitted_at
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        join public.tournaments t on t.id = p.tournament_id
        where p.id = p_prediction_id
          and auth.uid() is not null
          and (p.submitted_at is not null or public.prediction_phase1_complete(p.id))
          and tp.paid_at <= t.lock_time
    )
    select
        e.id as prediction_id,
        e.prediction_name::text,
        pr.username::text as username,
        e.total_goals,
        e.submitted_at,
        coalesce(
            (select jsonb_agg(jsonb_build_object(
                'group_id', gp.group_id,
                'first_team_id', gp.first_team_id,
                'second_team_id', gp.second_team_id,
                'third_team_id', gp.third_team_id,
                'fourth_team_id', gp.fourth_team_id
            ) order by gp.group_id)
            from public.group_predictions gp
            where gp.prediction_id = e.id),
            '[]'::jsonb
        ) as groups,
        coalesce(
            (select jsonb_agg(jsonb_build_object(
                'match_id', kp.match_id,
                'winner_team_id', kp.winner_team_id
            ) order by kp.match_id)
            from public.knockout_predictions kp
            where kp.prediction_id = e.id),
            '[]'::jsonb
        ) as knockout,
        coalesce(
            (select jsonb_agg(jsonb_build_object(
                'rank', ap.rank,
                'team_id', ap.team_id
            ) order by ap.rank)
            from public.advancer_predictions ap
            where ap.prediction_id = e.id),
            '[]'::jsonb
        ) as advancers
    from elig e
    join public.profiles pr on pr.id = e.user_id;
$$;
