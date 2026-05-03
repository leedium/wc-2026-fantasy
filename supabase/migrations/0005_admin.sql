-- WC2026 — Admin console: RLS expansions + 5 admin RPCs.

-- ========== RLS: admin can write any prediction row (lock-bypassing) ==========

create policy "predictions_admin_write"
    on public.predictions for all
    using (public.is_admin())
    with check (public.is_admin());

create policy "group_predictions_admin_write"
    on public.group_predictions for all
    using (public.is_admin())
    with check (public.is_admin());

create policy "knockout_predictions_admin_write"
    on public.knockout_predictions for all
    using (public.is_admin())
    with check (public.is_admin());

-- ========== RPC: admin_submit_predictions ==========
-- Mirrors public.submit_predictions, but operates on an arbitrary p_user_id and
-- bypasses the lock check. Caller must be an admin.
create or replace function public.admin_submit_predictions(p_user_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
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
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if v_tournament_id is null then
        raise exception 'tournament_id is required' using errcode = 'P0001';
    end if;

    insert into public.predictions (user_id, tournament_id, total_goals, submitted_at)
    values (p_user_id, v_tournament_id, v_total_goals, now())
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

grant execute on function public.admin_submit_predictions(uuid, jsonb) to authenticated;

-- ========== RPC: admin_set_group_standing ==========
create or replace function public.admin_set_group_standing(
    p_tournament_id uuid,
    p_group_id text,
    p_first text,
    p_second text,
    p_third text,
    p_fourth text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_team_ids text[];
    v_mismatched text;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_first is null or p_second is null or p_third is null or p_fourth is null then
        raise exception 'all four positions are required' using errcode = 'P0001';
    end if;

    if cardinality(array[p_first, p_second, p_third, p_fourth]) <> 4
       or p_first in (p_second, p_third, p_fourth)
       or p_second in (p_third, p_fourth)
       or p_third = p_fourth then
        raise exception 'positions must be distinct' using errcode = 'P0001';
    end if;

    v_team_ids := array[p_first, p_second, p_third, p_fourth];

    select t.id into v_mismatched
    from public.teams t
    where t.id = any(v_team_ids) and t.group_id is distinct from p_group_id
    limit 1;

    if v_mismatched is not null then
        raise exception 'team % does not belong to group %', v_mismatched, p_group_id
            using errcode = 'P0001';
    end if;

    insert into public.group_standings (
        tournament_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id, submitted_at
    ) values (
        p_tournament_id, p_group_id, p_first, p_second, p_third, p_fourth, now()
    )
    on conflict (tournament_id, group_id)
    do update set
        first_team_id = excluded.first_team_id,
        second_team_id = excluded.second_team_id,
        third_team_id = excluded.third_team_id,
        fourth_team_id = excluded.fourth_team_id,
        submitted_at = now();
end;
$$;

grant execute on function public.admin_set_group_standing(uuid, text, text, text, text, text) to authenticated;

-- ========== RPC: admin_set_knockout_result ==========
create or replace function public.admin_set_knockout_result(
    p_tournament_id uuid,
    p_match_id text,
    p_winner_team_id text,
    p_loser_team_id text,
    p_total_goals int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_winner_team_id is null or p_loser_team_id is null then
        raise exception 'winner and loser are required' using errcode = 'P0001';
    end if;

    if p_winner_team_id = p_loser_team_id then
        raise exception 'winner and loser must be different teams' using errcode = 'P0001';
    end if;

    if not exists (select 1 from public.knockout_matches where id = p_match_id) then
        raise exception 'unknown match %', p_match_id using errcode = 'P0001';
    end if;

    insert into public.knockout_results (
        tournament_id, match_id, winner_team_id, loser_team_id, total_goals, submitted_at
    ) values (
        p_tournament_id, p_match_id, p_winner_team_id, p_loser_team_id, p_total_goals, now()
    )
    on conflict (tournament_id, match_id)
    do update set
        winner_team_id = excluded.winner_team_id,
        loser_team_id = excluded.loser_team_id,
        total_goals = excluded.total_goals,
        submitted_at = now();
end;
$$;

grant execute on function public.admin_set_knockout_result(uuid, text, text, text, int) to authenticated;

-- ========== RPC: admin_set_user_admin ==========
create or replace function public.admin_set_user_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_other_admin_count int;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_is_admin = false then
        select count(*) into v_other_admin_count
        from public.profiles
        where is_admin = true and id <> p_user_id;
        if v_other_admin_count = 0 then
            raise exception 'cannot demote last admin' using errcode = 'P0001';
        end if;
    end if;

    update public.profiles set is_admin = p_is_admin where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;

-- The prevent_admin_self_elevation trigger uses public.is_admin() which checks
-- the *caller's* admin status; SECURITY DEFINER functions run as the function
-- owner (postgres) but auth.uid() still returns the actual session user, and
-- we've already gated the function on is_admin(). The trigger therefore allows
-- the underlying UPDATE because is_admin() returns true for the caller.

-- ========== RPC: admin_list_users ==========
-- Paginated user list with active-tournament submission state.
create or replace function public.admin_list_users(
    p_search text,
    p_page int,
    p_page_size int
)
returns table (
    id uuid,
    username text,
    is_admin boolean,
    has_prediction boolean,
    submitted_at timestamptz,
    total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tournament_id uuid;
    v_offset int;
    v_limit int;
    v_search text;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    v_limit := greatest(1, least(coalesce(p_page_size, 25), 100));
    v_offset := greatest(0, (coalesce(p_page, 1) - 1) * v_limit);
    v_search := nullif(trim(coalesce(p_search, '')), '');

    select t.id into v_tournament_id from public.tournaments t where t.is_active limit 1;

    return query
    with filtered as (
        select
            p.id,
            p.username::text as username,
            p.is_admin,
            pr.id is not null as has_prediction,
            pr.submitted_at
        from public.profiles p
        left join public.predictions pr
            on pr.user_id = p.id and pr.tournament_id = v_tournament_id
        where v_search is null or p.username::text ilike '%' || v_search || '%'
    ),
    counted as (
        select count(*) as total from filtered
    )
    select
        f.id,
        f.username,
        f.is_admin,
        f.has_prediction,
        f.submitted_at,
        c.total
    from filtered f
    cross join counted c
    order by f.username asc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_users(text, int, int) to authenticated;
