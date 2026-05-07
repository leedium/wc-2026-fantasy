-- Multi-prediction support — Phase 4: replace RPCs and the new-user trigger.
--
-- Reworks every server-side function that assumed one prediction per user.
-- Functions whose return type changes need DROP+CREATE.

-- ========== handle_new_user — auto-generate username when not provided ==========
-- Admin-create flow still passes an explicit username via raw_user_meta_data.
-- Self-signup no longer collects a username; we generate user_<8 hex chars>
-- and retry on the (extremely rare) collision.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    meta_username text;
    candidate text;
    attempts int := 0;
begin
    meta_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

    if meta_username is not null then
        begin
            insert into public.profiles (id, username) values (new.id, meta_username);
        exception
            when unique_violation then
                raise exception 'username taken' using errcode = 'P0001';
            when check_violation then
                raise exception 'username invalid format' using errcode = 'P0001';
        end;
        return new;
    end if;

    loop
        candidate := 'user_' || encode(extensions.gen_random_bytes(4), 'hex');
        begin
            insert into public.profiles (id, username) values (new.id, candidate);
            exit;
        exception
            when unique_violation then
                attempts := attempts + 1;
                if attempts >= 10 then
                    raise exception 'could not generate unique username' using errcode = 'P0001';
                end if;
        end;
    end loop;

    return new;
end;
$$;

-- ========== submit_predictions — create or update a single prediction ==========
-- Payload shape:
--   {
--     "tournament_id": "uuid",
--     "prediction_id": "uuid"|null,   -- null = create
--     "prediction_name": "text",      -- required on create, optional on update
--     "total_goals": int|null,
--     "groups": [{"group_id":"A","first":...,"second":...,"third":...,"fourth":...}, ...],
--     "knockout": [{"match_id":"M1","winner":...}, ...]
--   }
-- Cap of 5 predictions per (user, tournament) enforced under an advisory
-- transaction lock to close the create-then-count race.

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
    v_user uuid := auth.uid();
    v_existing_count int;
    v_group jsonb;
    v_match jsonb;
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
        -- CREATE branch
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
            values (v_user, v_tournament_id, v_prediction_name, v_total_goals, now())
            returning id into v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    else
        -- UPDATE branch
        perform 1 from public.predictions
            where id = v_prediction_id and user_id = v_user and tournament_id = v_tournament_id;
        if not found then
            raise exception 'prediction not found' using errcode = 'P0001';
        end if;

        begin
            update public.predictions
               set prediction_name = coalesce(v_prediction_name, prediction_name),
                   total_goals = v_total_goals,
                   submitted_at = now()
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

-- ========== admin_submit_predictions — same branching, no auth/lock check ==========

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
            values (p_user_id, v_tournament_id, v_prediction_name, v_total_goals, now())
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
                   submitted_at = now()
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

-- ========== admin_set_prediction_payment — replaces admin_set_payment ==========

drop function if exists public.admin_set_payment(uuid, uuid, boolean, timestamptz);

create or replace function public.admin_set_prediction_payment(
    p_prediction_id uuid,
    p_paid boolean,
    p_paid_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_tournament_id uuid;
    v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_prediction_id is null then
        raise exception 'prediction_id is required' using errcode = 'P0001';
    end if;

    select user_id, tournament_id
      into v_user_id, v_tournament_id
      from public.predictions
     where id = p_prediction_id;

    if not found then
        raise exception 'prediction not found' using errcode = 'P0001';
    end if;

    if p_paid then
        insert into public.tournament_payments (user_id, tournament_id, prediction_id, paid_at, marked_by)
        values (v_user_id, v_tournament_id, p_prediction_id, v_paid_at, auth.uid())
        on conflict (prediction_id) do update
            set paid_at = excluded.paid_at,
                marked_by = excluded.marked_by;
    else
        delete from public.tournament_payments where prediction_id = p_prediction_id;
    end if;
end;
$$;

grant execute on function public.admin_set_prediction_payment(uuid, boolean, timestamptz) to authenticated;

-- ========== admin_list_users — return per-user prediction counts ==========

drop function if exists public.admin_list_users(text, int, int);

create or replace function public.admin_list_users(
    p_search text,
    p_page int,
    p_page_size int
)
returns table (
    id uuid,
    username text,
    is_admin boolean,
    is_super_admin boolean,
    prediction_count int,
    paid_prediction_count int,
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
            p.is_super_admin,
            coalesce(counts.prediction_count, 0)::int as prediction_count,
            coalesce(counts.paid_prediction_count, 0)::int as paid_prediction_count
        from public.profiles p
        left join lateral (
            select
                count(*) as prediction_count,
                count(*) filter (
                    where exists (
                        select 1 from public.tournament_payments tp
                        where tp.prediction_id = pr.id
                    )
                ) as paid_prediction_count
            from public.predictions pr
            where pr.user_id = p.id and pr.tournament_id = v_tournament_id
        ) counts on true
        where v_search is null or p.username::text ilike '%' || v_search || '%'
    ),
    counted as (
        select count(*) as total from filtered
    )
    select
        f.id,
        f.username,
        f.is_admin,
        f.is_super_admin,
        f.prediction_count,
        f.paid_prediction_count,
        c.total
    from filtered f
    cross join counted c
    order by f.username asc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_users(text, int, int) to authenticated;

-- ========== get_leaderboard — one row per paid prediction ==========

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
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
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
        knockout_points,
        total_goals,
        count(*) over () as total_count
    from ranked
    order by rank
    offset greatest(p_page - 1, 0) * greatest(p_page_size, 1)
    limit greatest(p_page_size, 1);
$$;

grant execute on function public.get_leaderboard(uuid, int, int) to anon, authenticated;

-- ========== get_leaderboard_rank — one row per paid prediction owned by user ==========

drop function if exists public.get_leaderboard_rank(uuid, citext, int);

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
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
            p.user_id,
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
        left join group_scores gsc on gsc.prediction_id = p.id
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
