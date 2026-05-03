-- Create a profile row automatically on auth.users insert,
-- pulling username from raw_user_meta_data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    chosen_username text;
begin
    chosen_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
    if chosen_username is null then
        raise exception 'username is required';
    end if;

    begin
        insert into public.profiles (id, username)
        values (new.id, chosen_username);
    exception
        when unique_violation then
            raise exception 'username taken' using errcode = 'P0001';
        when check_violation then
            raise exception 'username invalid format' using errcode = 'P0001';
    end;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RPC: submit_predictions
-- Upserts the user's predictions + all group/knockout child rows in one call.
-- Payload shape:
--   {
--     "tournament_id": "uuid",
--     "total_goals": 172,
--     "groups": [{"group_id":"A","first":"usa","second":"mex","third":"can","fourth":"jam"}, ...],
--     "knockout": [{"match_id":"M1","winner":"usa"}, ...]
--   }
create or replace function public.submit_predictions(payload jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
    v_tournament_id uuid := (payload->>'tournament_id')::uuid;
    v_total_goals int := nullif(payload->>'total_goals', '')::int;
    v_prediction_id uuid;
    v_group jsonb;
    v_match jsonb;
    v_group_id text;
    v_team_ids text[];
    v_mismatched_team text;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    if not public.is_before_lock(v_tournament_id) then
        raise exception 'predictions are locked';
    end if;

    insert into public.predictions (user_id, tournament_id, total_goals, submitted_at)
    values (auth.uid(), v_tournament_id, v_total_goals, now())
    on conflict (user_id, tournament_id)
    do update set
        total_goals = excluded.total_goals,
        submitted_at = now()
    returning id into v_prediction_id;

    delete from public.group_predictions where prediction_id = v_prediction_id;
    delete from public.knockout_predictions where prediction_id = v_prediction_id;

    for v_group in select * from jsonb_array_elements(payload->'groups')
    loop
        v_group_id := v_group->>'group_id';
        v_team_ids := array_remove(array[
            nullif(v_group->>'first', ''),
            nullif(v_group->>'second', ''),
            nullif(v_group->>'third', ''),
            nullif(v_group->>'fourth', '')
        ], null);

        -- Validate that each non-null team belongs to this group.
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

    for v_match in select * from jsonb_array_elements(payload->'knockout')
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
