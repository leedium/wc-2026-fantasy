-- Phase 1 Champions Pick.
--
-- Adds `predictions.champion_team_id` — a single team_id the user nominates as
-- their tournament champion during Phase 1. Awards +5 bonus points when the
-- pick matches the actual M32 winner (independent of the bracket Final pick).
--
-- The pick is treated as a Phase 1 field: it is writable only during 'phase1'
-- (same gating as `groups` + `advancers`) and is required when creating a new
-- prediction. Once `phase1_locked` flips, it becomes immutable.
--
-- Migration is purely additive — new nullable column, four `create or replace`
-- function bodies, and one `create or replace` on `get_public_prediction` to
-- surface the pick alongside groups/knockout/advancers. Existing prediction
-- rows keep `champion_team_id = null` and simply score 0 bonus until the owner
-- edits the prediction (while phase1 is still open) to add a pick.

-- ========== schema ==========

alter table public.predictions
    add column if not exists champion_team_id text references public.teams(id);

create index if not exists predictions_champion_team_id_idx
    on public.predictions(champion_team_id);

-- ========== submit_predictions ==========
-- Replaces 0034 body. Adds:
--   * v_champion_team_id extraction
--   * required-on-create check
--   * persist on insert + on update during phase1 only

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
    v_champion_team_id text := nullif(payload->>'champion_team_id', '');
    v_has_champion_key boolean := payload ? 'champion_team_id';
    v_mark_submitted boolean := coalesce((payload->>'submit')::boolean, true);
    v_user uuid := auth.uid();
    v_phase text;
    v_has_phase1_fields boolean;
    v_has_phase2_fields boolean;
    v_group jsonb;
    v_match jsonb;
    v_advancer jsonb;
    v_rank int;
    v_team_id text;
    v_seen_ranks int[] := '{}';
    v_seen_teams text[] := '{}';
    v_valid_thirds text[];
    v_group_id text;
    v_team_ids text[];
    v_mismatched_team text;
begin
    if v_user is null then
        raise exception 'not authenticated';
    end if;

    v_phase := public.tournament_phase(v_tournament_id);

    if v_prediction_id is null and v_phase <> 'phase1' then
        raise exception 'phase 1 ended; new predictions cannot be created'
            using errcode = 'P0001';
    end if;

    v_has_phase1_fields := (payload ? 'groups' and jsonb_array_length(payload->'groups') > 0)
        or (payload ? 'advancers' and jsonb_array_length(payload->'advancers') > 0)
        or v_has_champion_key;
    v_has_phase2_fields := (payload ? 'knockout' and jsonb_array_length(payload->'knockout') > 0)
        or (v_total_goals is not null);

    if v_phase = 'phase1_locked' or v_phase = 'phase2_locked' then
        raise exception 'predictions are locked';
    end if;

    if v_phase = 'phase1' and v_has_phase2_fields then
        raise exception 'phase 1 only fields allowed' using errcode = 'P0001';
    end if;
    if v_phase = 'phase2_open' and v_has_phase1_fields then
        raise exception 'phase 1 ended; group + advancer picks are frozen'
            using errcode = 'P0001';
    end if;

    if v_prediction_id is null then
        if v_prediction_name is null then
            raise exception 'prediction name required' using errcode = 'P0001';
        end if;
        if v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            insert into public.predictions (
                user_id, tournament_id, prediction_name, total_goals,
                champion_team_id, submitted_at
            )
            values (
                v_user,
                v_tournament_id,
                v_prediction_name,
                v_total_goals,
                v_champion_team_id,
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

        if v_has_champion_key and v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            update public.predictions
               set prediction_name = coalesce(v_prediction_name, prediction_name),
                   total_goals = case when v_phase = 'phase2_open' then v_total_goals else total_goals end,
                   champion_team_id = case
                       when v_phase = 'phase1' and v_has_champion_key then v_champion_team_id
                       else champion_team_id
                   end,
                   submitted_at = case when v_mark_submitted then now() else submitted_at end
             where id = v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    end if;

    if v_phase = 'phase1' then
        delete from public.advancer_predictions where prediction_id = v_prediction_id;
        delete from public.group_predictions where prediction_id = v_prediction_id;

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

        select array_agg(third_team_id) into v_valid_thirds
          from public.group_predictions
         where prediction_id = v_prediction_id
           and third_team_id is not null;

        for v_advancer in select * from jsonb_array_elements(coalesce(payload->'advancers', '[]'::jsonb))
        loop
            v_rank := nullif(v_advancer->>'rank', '')::int;
            v_team_id := nullif(v_advancer->>'team_id', '');
            if v_team_id is null then
                continue;
            end if;
            if v_rank is null or v_rank < 1 or v_rank > 8 then
                raise exception 'advancer rank must be 1..8 (got %)', v_rank using errcode = 'P0001';
            end if;
            if v_rank = any(v_seen_ranks) then
                raise exception 'duplicate advancer rank %', v_rank using errcode = 'P0001';
            end if;
            if v_team_id = any(v_seen_teams) then
                raise exception 'duplicate advancer team' using errcode = 'P0001';
            end if;
            if v_valid_thirds is null or not (v_team_id = any(v_valid_thirds)) then
                raise exception 'advancer team % not in your 3rd-place picks', v_team_id
                    using errcode = 'P0001';
            end if;
            v_seen_ranks := array_append(v_seen_ranks, v_rank);
            v_seen_teams := array_append(v_seen_teams, v_team_id);

            insert into public.advancer_predictions (prediction_id, rank, team_id)
            values (v_prediction_id, v_rank, v_team_id);
        end loop;
    elsif v_phase = 'phase2_open' then
        delete from public.knockout_predictions where prediction_id = v_prediction_id;
        for v_match in select * from jsonb_array_elements(coalesce(payload->'knockout', '[]'::jsonb))
        loop
            insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
            values (
                v_prediction_id,
                v_match->>'match_id',
                nullif(v_match->>'winner', '')
            );
        end loop;
    end if;

    return v_prediction_id;
end;
$$;

-- ========== admin_submit_predictions ==========

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
    v_champion_team_id text := nullif(payload->>'champion_team_id', '');
    v_has_champion_key boolean := payload ? 'champion_team_id';
    v_mark_submitted boolean := coalesce((payload->>'submit')::boolean, true);
    v_phase text;
    v_super boolean;
    v_group jsonb;
    v_match jsonb;
    v_advancer jsonb;
    v_rank int;
    v_team_id text;
    v_seen_ranks int[] := '{}';
    v_seen_teams text[] := '{}';
    v_valid_thirds text[];
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

    v_super := public.is_super_admin();
    v_phase := public.tournament_phase(v_tournament_id);

    if not v_super then
        if v_prediction_id is null and v_phase <> 'phase1' then
            raise exception 'phase 1 ended; new predictions cannot be created'
                using errcode = 'P0001';
        end if;
        if v_phase = 'phase1_locked' or v_phase = 'phase2_locked' then
            raise exception 'predictions are locked';
        end if;
    end if;

    if v_prediction_id is null then
        if v_prediction_name is null then
            raise exception 'prediction name required' using errcode = 'P0001';
        end if;
        if v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            insert into public.predictions (
                user_id, tournament_id, prediction_name, total_goals,
                champion_team_id, submitted_at
            )
            values (
                p_user_id,
                v_tournament_id,
                v_prediction_name,
                v_total_goals,
                v_champion_team_id,
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

        if v_has_champion_key and v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            update public.predictions
               set prediction_name = coalesce(v_prediction_name, prediction_name),
                   total_goals = v_total_goals,
                   champion_team_id = case
                       when v_has_champion_key and (v_super or v_phase = 'phase1')
                           then v_champion_team_id
                       else champion_team_id
                   end,
                   submitted_at = case when v_mark_submitted then now() else submitted_at end
             where id = v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    end if;

    if v_super or v_phase = 'phase1' then
        delete from public.advancer_predictions where prediction_id = v_prediction_id;
        delete from public.group_predictions where prediction_id = v_prediction_id;

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

        select array_agg(third_team_id) into v_valid_thirds
          from public.group_predictions
         where prediction_id = v_prediction_id
           and third_team_id is not null;

        for v_advancer in select * from jsonb_array_elements(coalesce(payload->'advancers', '[]'::jsonb))
        loop
            v_rank := nullif(v_advancer->>'rank', '')::int;
            v_team_id := nullif(v_advancer->>'team_id', '');
            if v_team_id is null then
                continue;
            end if;
            if v_rank is null or v_rank < 1 or v_rank > 8 then
                raise exception 'advancer rank must be 1..8 (got %)', v_rank using errcode = 'P0001';
            end if;
            if v_rank = any(v_seen_ranks) then
                raise exception 'duplicate advancer rank %', v_rank using errcode = 'P0001';
            end if;
            if v_team_id = any(v_seen_teams) then
                raise exception 'duplicate advancer team' using errcode = 'P0001';
            end if;
            if v_valid_thirds is null or not (v_team_id = any(v_valid_thirds)) then
                raise exception 'advancer team % not in your 3rd-place picks', v_team_id
                    using errcode = 'P0001';
            end if;
            v_seen_ranks := array_append(v_seen_ranks, v_rank);
            v_seen_teams := array_append(v_seen_teams, v_team_id);

            insert into public.advancer_predictions (prediction_id, rank, team_id)
            values (v_prediction_id, v_rank, v_team_id);
        end loop;
    end if;

    if v_super or v_phase = 'phase2_open' then
        delete from public.knockout_predictions where prediction_id = v_prediction_id;
        for v_match in select * from jsonb_array_elements(coalesce(payload->'knockout', '[]'::jsonb))
        loop
            insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
            values (
                v_prediction_id,
                v_match->>'match_id',
                nullif(v_match->>'winner', '')
            );
        end loop;
    end if;

    return v_prediction_id;
end;
$$;

grant execute on function public.admin_submit_predictions(uuid, jsonb) to authenticated;

-- ========== get_leaderboard ==========
-- Adds a `champion_pick_score` CTE that awards 5 when predictions.champion_team_id
-- equals the M32 winner. Folded into knockout_scores (so total `points`
-- accounts for it) and surfaced as a new output column `champion_pick_points`.
--
-- Postgres treats a new OUT column as a return-type change, so the function
-- must be dropped before re-creation.

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
    champion_pick_score as (
        select
            p.id as prediction_id,
            (case
                when p.champion_team_id is not null and p.champion_team_id = kr.winner_team_id then 5
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
            (coalesce(r16.round_points, 0)
             + coalesce(qf.round_points, 0)
             + coalesce(sf.round_points, 0)
             + coalesce(fs.round_points, 0)
             + coalesce(cs.points, 0)
             + coalesce(tps.points, 0))::int as knockout_points,
            coalesce(cps.points, 0)::int as champion_pick_points
        from public.predictions p
        left join r16_scores r16 on r16.prediction_id = p.id
        left join qf_scores qf on qf.prediction_id = p.id
        left join sf_scores sf on sf.prediction_id = p.id
        left join f_scores fs on fs.prediction_id = p.id
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
    champion_pick_score as (
        select
            p.id as prediction_id,
            (case
                when p.champion_team_id is not null and p.champion_team_id = kr.winner_team_id then 5
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
            (coalesce(r16.round_points, 0)
             + coalesce(qf.round_points, 0)
             + coalesce(sf.round_points, 0)
             + coalesce(fs.round_points, 0)
             + coalesce(cs.points, 0)
             + coalesce(tps.points, 0))::int as knockout_points,
            coalesce(cps.points, 0)::int as champion_pick_points
        from public.predictions p
        left join r16_scores r16 on r16.prediction_id = p.id
        left join qf_scores qf on qf.prediction_id = p.id
        left join sf_scores sf on sf.prediction_id = p.id
        left join f_scores fs on fs.prediction_id = p.id
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

-- ========== get_public_prediction ==========
-- Expose champion_team_id alongside the existing groups/knockout/advancers
-- payload so the public bracket-detail view can render the user's pick.
-- Adding an OUT column is a return-type change → drop first.

drop function if exists public.get_public_prediction(uuid);

create or replace function public.get_public_prediction(p_prediction_id uuid)
returns table (
    prediction_id uuid,
    prediction_name text,
    username text,
    total_goals int,
    champion_team_id text,
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
        select p.id, p.user_id, p.tournament_id, p.prediction_name, p.total_goals,
               p.champion_team_id, p.submitted_at
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
        e.champion_team_id,
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

grant execute on function public.get_public_prediction(uuid) to authenticated;
