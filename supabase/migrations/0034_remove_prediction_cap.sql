-- Remove the 5-prediction-per-(user, tournament) cap.
--
-- Replaces submit_predictions and admin_submit_predictions from 0027 with
-- bodies identical except:
--   * no pg_advisory_xact_lock (it only existed to close the count-then-insert
--     race for the cap check),
--   * no count(*) + 'prediction limit reached' check,
--   * v_existing_count declaration removed.
--
-- Per-prediction prediction_name uniqueness is still enforced by the existing
-- unique index, so users still can't create duplicate names; they can simply
-- create as many distinct named predictions as they want.

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
        or (payload ? 'advancers' and jsonb_array_length(payload->'advancers') > 0);
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
                   total_goals = case when v_phase = 'phase2_open' then v_total_goals else total_goals end,
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
