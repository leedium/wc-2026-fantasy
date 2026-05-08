-- Super admin gate for post-lock writes.
--
-- Adds is_super_admin() helper and replaces admin_submit_predictions to
-- require super admin AFTER the tournament lock_time. Regular admins can
-- still mark payments paid/unpaid past lock (admin_set_prediction_payment
-- is unaffected) but can no longer create or edit predictions past lock.
--
-- Also adds select_now() so the frontend can fetch the server's current
-- time and compute clock skew, making the lock countdown UI resistant to
-- device clock manipulation. (The real security boundary remains
-- is_before_lock(tid), which uses Postgres now() — this just keeps the UI
-- honest.)

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.select_now()
returns timestamptz
language sql
stable
as $$
    select now();
$$;

grant execute on function public.select_now() to anon, authenticated;

-- ========== admin_submit_predictions: restrict post-lock to super admin ==========
-- Body identical to 0017 except for the added is_super_admin gate after the
-- existing is_admin() check.

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
    -- Past lock, only super admins may write predictions.
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

    return v_prediction_id;
end;
$$;

grant execute on function public.admin_submit_predictions(uuid, jsonb) to authenticated;
