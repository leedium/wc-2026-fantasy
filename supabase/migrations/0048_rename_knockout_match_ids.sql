-- 0048_rename_knockout_match_ids.sql
--
-- Renames internal knockout match identifiers from M1..M32 to the
-- official FIFA 2026 match numbers M73..M104 (offset +72):
--
--   R32 (16):  M1..M16  -> M73..M88
--   R16  (8):  M17..M24 -> M89..M96
--   QF   (4):  M25..M28 -> M97..M100
--   SF   (2):  M29..M30 -> M101..M102
--   3rd  (1):  M31      -> M103
--   Final(1):  M32      -> M104
--
-- Pure renumbering. The team1_source / team2_source pointers are
-- rewritten to preserve the existing placement semantics (which
-- match feeds which) -- auditing those placements against the
-- official FIFA bracket is a separate follow-up (Step 2).
--
-- The FKs on knockout_predictions.match_id, knockout_results.match_id,
-- and r32_bracket_assignments.match_id are bare references (no ON
-- UPDATE CASCADE), so we drop them, rewrite parent + children, and
-- re-add them identically.
--
-- The two scoring functions in 0045_scoring_v3.sql hard-code 'M31' and
-- 'M32' as literals; they are re-emitted at the bottom of this file
-- verbatim with the 5 occurrences per function bumped to 'M103' /
-- 'M104'. They sit outside the idempotency guard so a partially
-- applied prior run still self-heals on re-run.

do $$
begin
    -- Idempotency guard: if M104 already exists we've already renamed.
    if exists (select 1 from public.knockout_matches where id = 'M104') then
        raise notice '0048: knockout match ids already renamed, skipping mutation';
        return;
    end if;

    -- Build a temp remap (M1..M32 -> M73..M104).
    create temporary table _kn_remap (
        old_id text primary key,
        new_id text not null unique
    ) on commit drop;

    insert into _kn_remap (old_id, new_id)
    select 'M' || n, 'M' || (n + 72)
    from generate_series(1, 32) as n;

    -- FKs to knockout_matches.id are bare references (no ON UPDATE
    -- CASCADE). Drop them so the parent PK can move; re-add identical
    -- constraints after the renumbering.
    alter table public.knockout_predictions
        drop constraint knockout_predictions_match_id_fkey;
    alter table public.knockout_results
        drop constraint knockout_results_match_id_fkey;
    alter table public.r32_bracket_assignments
        drop constraint r32_bracket_assignments_match_id_fkey;

    -- Update child rows first (so the parent PK update doesn't create
    -- transiently orphaned rows even if a constraint were enforced).
    update public.knockout_predictions kp
       set match_id = r.new_id
      from _kn_remap r
     where r.old_id = kp.match_id;

    update public.knockout_results kr
       set match_id = r.new_id
      from _kn_remap r
     where r.old_id = kr.match_id;

    update public.r32_bracket_assignments rb
       set match_id = r.new_id
      from _kn_remap r
     where r.old_id = rb.match_id;

    -- Update parent knockout_matches PK.
    update public.knockout_matches km
       set id = r.new_id
      from _kn_remap r
     where r.old_id = km.id;

    -- Rewrite plain ^M\d+$ pointers (R16/QF/SF/Final reference
    -- previous-round match ids in team{1,2}_source).
    update public.knockout_matches km
       set team1_source = r.new_id
      from _kn_remap r
     where r.old_id = km.team1_source;

    update public.knockout_matches km
       set team2_source = r.new_id
      from _kn_remap r
     where r.old_id = km.team2_source;

    -- Rewrite the M103 loser sources (third-place match takes the
    -- losers of the two semis).
    update public.knockout_matches
       set team1_source = 'L-M101'
     where id = 'M103' and team1_source = 'L-M29';
    update public.knockout_matches
       set team2_source = 'L-M102'
     where id = 'M103' and team2_source = 'L-M30';

    -- Re-add the FKs identical to 0001_initial_schema.sql /
    -- 0026_r32_bracket_assignment.sql.
    alter table public.knockout_predictions
        add constraint knockout_predictions_match_id_fkey
        foreign key (match_id) references public.knockout_matches(id);
    alter table public.knockout_results
        add constraint knockout_results_match_id_fkey
        foreign key (match_id) references public.knockout_matches(id);
    alter table public.r32_bracket_assignments
        add constraint r32_bracket_assignments_match_id_fkey
        foreign key (match_id) references public.knockout_matches(id);
end $$;

-- ========== get_leaderboard (re-emit from 0045_scoring_v3.sql) ==========
-- Verbatim copy of the 0045 body with 'M31' -> 'M103' and 'M32' -> 'M104'.

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

-- ========== get_leaderboard_rank (re-emit from 0045_scoring_v3.sql) ==========

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
