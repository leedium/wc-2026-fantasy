-- Two-phase tournament flow.
--
-- Phase 1: open until tournaments.lock_time (groups + bundles writable).
-- Phase 1 locked: lock_time <= now() and admin hasn't opened phase 2 yet.
-- Phase 2 open: admin set knockout_unlocked = true; users can write knockout
--   + total_goals until knockout_lock_time.
-- Phase 2 locked: now() >= knockout_lock_time (or admin closed phase 2).
--
-- Late joiners: a user who didn't submit a prediction by phase 1 lock cannot
-- create one in phase 2. Edits to existing phase-1 fields (groups, bundles)
-- raise once phase 1 closes. Super admins bypass the gates via
-- admin_submit_predictions.

alter table public.tournaments
    add column if not exists knockout_unlocked boolean not null default false,
    add column if not exists knockout_lock_time timestamptz;

-- ========== phase helpers ==========

create or replace function public.is_phase_one_open(tid uuid)
returns boolean
language sql
stable
as $$
    select coalesce((select now() < lock_time from public.tournaments where id = tid), false);
$$;

create or replace function public.is_phase_two_open(tid uuid)
returns boolean
language sql
stable
as $$
    select coalesce((
        select knockout_unlocked
            and (knockout_lock_time is null or now() < knockout_lock_time)
        from public.tournaments
        where id = tid
    ), false);
$$;

create or replace function public.tournament_phase(tid uuid)
returns text
language sql
stable
as $$
    select case
        when t is null then 'phase1'
        when public.is_phase_one_open(tid) then 'phase1'
        when public.is_phase_two_open(tid) then 'phase2_open'
        when t.knockout_unlocked then 'phase2_locked'
        else 'phase1_locked'
    end
    from (select * from public.tournaments where id = tid) t;
$$;

-- ========== submit_predictions: phase routing + late-joiner block ==========

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

    v_phase := public.tournament_phase(v_tournament_id);

    -- Late joiner: cannot create after phase 1 ends.
    if v_prediction_id is null and v_phase <> 'phase1' then
        raise exception 'phase 1 ended; new predictions cannot be created'
            using errcode = 'P0001';
    end if;

    v_has_phase1_fields := (payload ? 'groups' and jsonb_array_length(payload->'groups') > 0)
        or (payload ? 'bundles' and jsonb_array_length(payload->'bundles') > 0);
    v_has_phase2_fields := (payload ? 'knockout' and jsonb_array_length(payload->'knockout') > 0)
        or (v_total_goals is not null);

    -- Locked windows
    if v_phase = 'phase1_locked' or v_phase = 'phase2_locked' then
        raise exception 'predictions are locked';
    end if;

    -- Field-level phase gating
    if v_phase = 'phase1' and v_has_phase2_fields then
        raise exception 'phase 1 only fields allowed' using errcode = 'P0001';
    end if;
    if v_phase = 'phase2_open' and v_has_phase1_fields then
        raise exception 'phase 1 ended; group + bundle picks are frozen'
            using errcode = 'P0001';
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
                   total_goals = case when v_phase = 'phase2_open' then v_total_goals else total_goals end,
                   submitted_at = case when v_mark_submitted then now() else submitted_at end
             where id = v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    end if;

    -- Replace child rows only for the fields the current phase permits.
    if v_phase = 'phase1' then
        delete from public.group_predictions where prediction_id = v_prediction_id;
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

-- ========== admin_submit_predictions: super admin = god mode ==========
-- Regular admins follow the same phase rules as users (no post-phase writes).
-- Super admins can write any field at any time.

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

    v_super := public.is_super_admin();
    v_phase := public.tournament_phase(v_tournament_id);

    -- Regular admins: same phase gates as users.
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

    -- Super admin god mode: replace whichever child sets are present in the
    -- payload. Regular admin: only the child set permitted by current phase.
    if v_super or v_phase = 'phase1' then
        delete from public.group_predictions where prediction_id = v_prediction_id;
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

-- ========== admin_set_third_place_advancer ==========

create or replace function public.admin_set_third_place_advancer(
    p_tournament_id uuid,
    p_slot_index int,
    p_group_letter text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_allowed text[];
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    select allowed_letters into v_allowed
      from public.third_place_bundles
     where slot_index = p_slot_index;
    if v_allowed is null then
        raise exception 'unknown bundle slot %', p_slot_index using errcode = 'P0001';
    end if;
    if not (p_group_letter = any (v_allowed)) then
        raise exception 'invalid bundle group letter % for slot %', p_group_letter, p_slot_index
            using errcode = 'P0001';
    end if;

    insert into public.tournament_third_place_advancers (tournament_id, slot_index, group_letter)
    values (p_tournament_id, p_slot_index, p_group_letter)
    on conflict (tournament_id, slot_index)
    do update set group_letter = excluded.group_letter;
end;
$$;

grant execute on function public.admin_set_third_place_advancer(uuid, int, text) to authenticated;

-- ========== admin_set_phase_two ==========
-- Flips the phase-2 gate. Requires all 8 advancers populated to flip true.

create or replace function public.admin_set_phase_two(
    p_tournament_id uuid,
    p_unlocked boolean,
    p_lock_time timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_advancer_count int;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_unlocked then
        select count(*) into v_advancer_count
          from public.tournament_third_place_advancers
         where tournament_id = p_tournament_id;
        if v_advancer_count <> 8 then
            raise exception 'all 8 advancers must be set before opening phase 2'
                using errcode = 'P0001';
        end if;
    end if;

    update public.tournaments
       set knockout_unlocked = p_unlocked,
           knockout_lock_time = case when p_unlocked then p_lock_time else knockout_lock_time end
     where id = p_tournament_id;
end;
$$;

grant execute on function public.admin_set_phase_two(uuid, boolean, timestamptz) to authenticated;
