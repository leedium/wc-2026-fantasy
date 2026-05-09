-- Wire third-place bundle picks into submit_predictions /
-- admin_submit_predictions, and add bundle_points to the leaderboard.
--
-- Payload extends with `third_place_bundles: [{slot_index, group_letter}, ...]`.
-- Each row is validated against `third_place_bundles.allowed_letters` before
-- writing.
--
-- Scoring: +0.5 per correct slot. The match is `predicted_letter ==
-- tournament_third_place_advancers.group_letter` for each slot. If the
-- advancers table is empty (admin hasn't populated yet), bundle_points = 0.

-- ========== submit_predictions ==========

create or replace function public.submit_predictions(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_tournament_id uuid := (payload->>'tournament_id')::uuid;
    v_prediction_id uuid := nullif(payload->>'prediction_id', '')::uuid;
    v_prediction_name text := nullif(trim(payload->>'prediction_name'), '');
    v_total_goals int := nullif(payload->>'total_goals', '')::int;
    v_mark_submitted boolean := coalesce((payload->>'submit')::boolean, true);
    v_user uuid := auth.uid();
    v_existing_count int;
    v_group jsonb;
    v_match jsonb;
    v_bundle jsonb;
    v_slot_index int;
    v_group_letter text;
    v_allowed text[];
    v_group_id text;
    v_team_ids text[];
    v_mismatched_team text;
begin
    if v_user is null then
        raise exception 'not authenticated';
    end if;

    if not public.is_before_lock(v_tournament_id) then
        raise exception 'predictions are locked';
    end if;

    if v_prediction_id is null then
        if v_prediction_name is null then
            raise exception 'prediction name required' using errcode = 'P0001';
        end if;

        perform pg_advisory_xact_lock(hashtext(v_user::text || ':' || v_tournament_id::text));

        select count(*) into v_existing_count
          from public.predictions
         where user_id = v_user and tournament_id = v_tournament_id;
        if v_existing_count >= 5 then
            raise exception 'prediction limit reached' using errcode = 'P0001';
        end if;

        begin
            insert into public.predictions (user_id, tournament_id, prediction_name, total_goals, submitted_at)
            values (
                v_user,
                v_tournament_id,
                v_prediction_name,
                v_total_goals,
                case when v_mark_submitted then now() else null end
            )
            returning id into v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    else
        perform 1 from public.predictions
            where id = v_prediction_id and user_id = v_user and tournament_id = v_tournament_id;
        if not found then
            raise exception 'prediction not found' using errcode = 'P0001';
        end if;

        begin
            update public.predictions
               set prediction_name = coalesce(v_prediction_name, prediction_name),
                   total_goals = v_total_goals,
                   submitted_at = case when v_mark_submitted then now() else submitted_at end
             where id = v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    end if;

    delete from public.group_predictions where prediction_id = v_prediction_id;
    delete from public.knockout_predictions where prediction_id = v_prediction_id;
    delete from public.third_place_bundle_predictions where prediction_id = v_prediction_id;

    for v_group in select * from jsonb_array_elements(coalesce(payload->'groups', '[]'::jsonb))
    loop
        v_group_id := v_group->>'group_id';
        v_team_ids := array_remove(array[
            nullif(v_group->>'first', ''),
            nullif(v_group->>'second', ''),
            nullif(v_group->>'third', ''),
            nullif(v_group->>'fourth', '')
        ], null);

        select t.id into v_mismatched_team
          from public.teams t
         where t.id = any(v_team_ids) and t.group_id is distinct from v_group_id
         limit 1;

        if v_mismatched_team is not null then
            raise exception 'team % does not belong to group %', v_mismatched_team, v_group_id
                using errcode = 'P0001';
        end if;

        insert into public.group_predictions (
            prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id
        ) values (
            v_prediction_id,
            v_group_id,
            nullif(v_group->>'first', ''),
            nullif(v_group->>'second', ''),
            nullif(v_group->>'third', ''),
            nullif(v_group->>'fourth', '')
        );
    end loop;

    for v_match in select * from jsonb_array_elements(coalesce(payload->'knockout', '[]'::jsonb))
    loop
        insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
        values (
            v_prediction_id,
            v_match->>'match_id',
            nullif(v_match->>'winner', '')
        );
    end loop;

    for v_bundle in select * from jsonb_array_elements(coalesce(payload->'bundles', '[]'::jsonb))
    loop
        v_slot_index := (v_bundle->>'slot_index')::int;
        v_group_letter := nullif(v_bundle->>'group_letter', '');
        if v_group_letter is null then
            continue;
        end if;

        select allowed_letters into v_allowed
          from public.third_place_bundles
         where slot_index = v_slot_index;

        if v_allowed is null then
            raise exception 'unknown bundle slot %', v_slot_index using errcode = 'P0001';
        end if;
        if not (v_group_letter = any (v_allowed)) then
            raise exception 'invalid bundle group letter % for slot %', v_group_letter, v_slot_index
                using errcode = 'P0001';
        end if;

        insert into public.third_place_bundle_predictions (prediction_id, slot_index, group_letter)
        values (v_prediction_id, v_slot_index, v_group_letter);
    end loop;

    return v_prediction_id;
end;
$$;

-- ========== admin_submit_predictions ==========
-- Same change: accept and persist bundles.

create or replace function public.admin_submit_predictions(p_user_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tournament_id uuid := (payload->>'tournament_id')::uuid;
    v_prediction_id uuid := nullif(payload->>'prediction_id', '')::uuid;
    v_prediction_name text := nullif(trim(payload->>'prediction_name'), '');
    v_total_goals int := nullif(payload->>'total_goals', '')::int;
    v_mark_submitted boolean := coalesce((payload->>'submit')::boolean, true);
    v_existing_count int;
    v_group jsonb;
    v_match jsonb;
    v_bundle jsonb;
    v_slot_index int;
    v_group_letter text;
    v_allowed text[];
    v_group_id text;
    v_team_ids text[];
    v_mismatched_team text;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_user_id is null or v_tournament_id is null then
        raise exception 'user_id and tournament_id are required' using errcode = 'P0001';
    end if;
    if not public.is_super_admin() and not public.is_before_lock(v_tournament_id) then
        raise exception 'predictions are locked' using errcode = 'P0001';
    end if;

    if v_prediction_id is null then
        if v_prediction_name is null then
            raise exception 'prediction name required' using errcode = 'P0001';
        end if;

        perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || v_tournament_id::text));

        select count(*) into v_existing_count
          from public.predictions
         where user_id = p_user_id and tournament_id = v_tournament_id;
        if v_existing_count >= 5 then
            raise exception 'prediction limit reached' using errcode = 'P0001';
        end if;

        begin
            insert into public.predictions (user_id, tournament_id, prediction_name, total_goals, submitted_at)
            values (
                p_user_id,
                v_tournament_id,
                v_prediction_name,
                v_total_goals,
                case when v_mark_submitted then now() else null end
            )
            returning id into v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    else
        perform 1 from public.predictions
            where id = v_prediction_id and user_id = p_user_id and tournament_id = v_tournament_id;
        if not found then
            raise exception 'prediction not found' using errcode = 'P0001';
        end if;

        begin
            update public.predictions
               set prediction_name = coalesce(v_prediction_name, prediction_name),
                   total_goals = v_total_goals,
                   submitted_at = case when v_mark_submitted then now() else submitted_at end
             where id = v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    end if;

    delete from public.group_predictions where prediction_id = v_prediction_id;
    delete from public.knockout_predictions where prediction_id = v_prediction_id;
    delete from public.third_place_bundle_predictions where prediction_id = v_prediction_id;

    for v_group in select * from jsonb_array_elements(coalesce(payload->'groups', '[]'::jsonb))
    loop
        v_group_id := v_group->>'group_id';
        v_team_ids := array_remove(array[
            nullif(v_group->>'first', ''),
            nullif(v_group->>'second', ''),
            nullif(v_group->>'third', ''),
            nullif(v_group->>'fourth', '')
        ], null);

        select t.id into v_mismatched_team
          from public.teams t
         where t.id = any(v_team_ids) and t.group_id is distinct from v_group_id
         limit 1;

        if v_mismatched_team is not null then
            raise exception 'team % does not belong to group %', v_mismatched_team, v_group_id
                using errcode = 'P0001';
        end if;

        insert into public.group_predictions (
            prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id
        ) values (
            v_prediction_id,
            v_group_id,
            nullif(v_group->>'first', ''),
            nullif(v_group->>'second', ''),
            nullif(v_group->>'third', ''),
            nullif(v_group->>'fourth', '')
        );
    end loop;

    for v_match in select * from jsonb_array_elements(coalesce(payload->'knockout', '[]'::jsonb))
    loop
        insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
        values (
            v_prediction_id,
            v_match->>'match_id',
            nullif(v_match->>'winner', '')
        );
    end loop;

    for v_bundle in select * from jsonb_array_elements(coalesce(payload->'bundles', '[]'::jsonb))
    loop
        v_slot_index := (v_bundle->>'slot_index')::int;
        v_group_letter := nullif(v_bundle->>'group_letter', '');
        if v_group_letter is null then
            continue;
        end if;

        select allowed_letters into v_allowed
          from public.third_place_bundles
         where slot_index = v_slot_index;

        if v_allowed is null then
            raise exception 'unknown bundle slot %', v_slot_index using errcode = 'P0001';
        end if;
        if not (v_group_letter = any (v_allowed)) then
            raise exception 'invalid bundle group letter % for slot %', v_group_letter, v_slot_index
                using errcode = 'P0001';
        end if;

        insert into public.third_place_bundle_predictions (prediction_id, slot_index, group_letter)
        values (v_prediction_id, v_slot_index, v_group_letter);
    end loop;

    return v_prediction_id;
end;
$$;

grant execute on function public.admin_submit_predictions(uuid, jsonb) to authenticated;

-- ========== get_leaderboard / get_leaderboard_rank: bundle_points ==========
-- Add bundle_points (numeric) and fold it into total points. group_points
-- and knockout_points stay int — only bundle_points and the total points
-- become numeric so 0.5 increments display correctly.

drop function if exists public.get_leaderboard(uuid, int, int);

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
    bundle_points numeric,
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
    bundle_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when tba.group_letter = bp.group_letter then 0.5
                    else 0
                end
            ), 0)::numeric as bundle_points
        from public.predictions p
        left join public.third_place_bundle_predictions bp on bp.prediction_id = p.id
        left join public.tournament_third_place_advancers tba
            on tba.tournament_id = p.tournament_id
            and tba.slot_index = bp.slot_index
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
            coalesce(bsc.bundle_points, 0)::numeric as bundle_points,
            coalesce(ksc.knockout_points, 0) as knockout_points,
            (coalesce(gsc.group_points, 0)
                + coalesce(bsc.bundle_points, 0)
                + coalesce(ksc.knockout_points, 0))::numeric as points,
            p.total_goals,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(bsc.bundle_points, 0)
                        + coalesce(ksc.knockout_points, 0)) desc,
                    case
                        when (select goals from actual_champion_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select goals from actual_champion_goals))
                    end asc nulls last,
                    p.submitted_at asc
            )::int as rank
        from public.predictions p
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join bundle_scores bsc on bsc.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and p.submitted_at is not null
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
        bundle_points,
        knockout_points,
        total_goals,
        count(*) over () as total_count
    from ranked
    order by rank
    offset greatest(p_page - 1, 0) * greatest(p_page_size, 1)
    limit greatest(p_page_size, 1);
$$;

grant execute on function public.get_leaderboard(uuid, int, int) to anon, authenticated;

-- ========== get_leaderboard_rank ==========

drop function if exists public.get_leaderboard_rank(uuid, uuid, int);

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
    bundle_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when tba.group_letter = bp.group_letter then 0.5
                    else 0
                end
            ), 0)::numeric as bundle_points
        from public.predictions p
        left join public.third_place_bundle_predictions bp on bp.prediction_id = p.id
        left join public.tournament_third_place_advancers tba
            on tba.tournament_id = p.tournament_id
            and tba.slot_index = bp.slot_index
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
                + coalesce(bsc.bundle_points, 0)
                + coalesce(ksc.knockout_points, 0))::numeric as points,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(bsc.bundle_points, 0)
                        + coalesce(ksc.knockout_points, 0)) desc,
                    case
                        when (select goals from actual_champion_goals) is null or p.total_goals is null then null
                        else abs(p.total_goals - (select goals from actual_champion_goals))
                    end asc nulls last,
                    p.submitted_at asc
            )::int as rank
        from public.predictions p
        left join group_scores gsc on gsc.prediction_id = p.id
        left join bundle_scores bsc on bsc.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and p.submitted_at is not null
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
