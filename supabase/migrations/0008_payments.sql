-- WC2026 — Payments (offline / cash, admin-recorded)
--
-- Entry to the prediction game is paid offline. An admin records, per
-- (user, tournament), that a user has paid. A user whose payment is missing
-- — or whose paid_at is after the tournament's lock_time — is excluded from
-- the leaderboard and ineligible to win.

-- ========== Table ==========

create table public.tournament_payments (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    paid_at       timestamptz not null default now(),
    marked_by     uuid not null references auth.users(id),
    unique (user_id, tournament_id)
);

create index tournament_payments_tournament_idx
    on public.tournament_payments (tournament_id);

alter table public.tournament_payments enable row level security;

create policy "tournament_payments_select_own_or_admin"
    on public.tournament_payments for select
    using (auth.uid() = user_id or public.is_admin());

create policy "tournament_payments_admin_write"
    on public.tournament_payments for all
    using (public.is_admin())
    with check (public.is_admin());

grant select on public.tournament_payments to authenticated;

-- ========== RPC: admin_set_payment ==========
-- p_paid_at lets the admin backdate to reflect when cash was actually
-- collected (defaults to now()). The leaderboard filter compares this to
-- tournaments.lock_time.
create or replace function public.admin_set_payment(
    p_user_id uuid,
    p_tournament_id uuid,
    p_paid boolean,
    p_paid_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_user_id is null or p_tournament_id is null then
        raise exception 'user_id and tournament_id are required' using errcode = 'P0001';
    end if;

    if p_paid then
        insert into public.tournament_payments (user_id, tournament_id, paid_at, marked_by)
        values (p_user_id, p_tournament_id, v_paid_at, auth.uid())
        on conflict (user_id, tournament_id) do update
            set paid_at = excluded.paid_at,
                marked_by = excluded.marked_by;
    else
        delete from public.tournament_payments
            where user_id = p_user_id and tournament_id = p_tournament_id;
    end if;
end;
$$;

grant execute on function public.admin_set_payment(uuid, uuid, boolean, timestamptz) to authenticated;

-- ========== RPC: admin_list_users (replace to add is_paid + paid_at) ==========
-- Return signature gains is_paid + paid_at columns; CREATE OR REPLACE can't
-- change OUT params, so drop the prior definition first.
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
    has_prediction boolean,
    submitted_at timestamptz,
    is_paid boolean,
    paid_at timestamptz,
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
            pr.submitted_at,
            tp.id is not null as is_paid,
            tp.paid_at
        from public.profiles p
        left join public.predictions pr
            on pr.user_id = p.id and pr.tournament_id = v_tournament_id
        left join public.tournament_payments tp
            on tp.user_id = p.id and tp.tournament_id = v_tournament_id
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
        f.is_paid,
        f.paid_at,
        c.total
    from filtered f
    cross join counted c
    order by f.username asc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_users(text, int, int) to authenticated;

-- ========== get_leaderboard (replace to filter on paid-by-lock) ==========
-- Identical to 0006_scoring_v2.sql except the `ranked` CTE's WHERE adds an
-- EXISTS clause requiring tournament_payments.paid_at <= tournaments.lock_time.
create or replace function public.get_leaderboard(
    p_tournament_id uuid,
    p_page int default 1,
    p_page_size int default 25
)
returns table (
    rank int,
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
              where tp.user_id = p.user_id
                and tp.tournament_id = p.tournament_id
                and tp.paid_at <= t.lock_time
          )
    )
    select
        rank,
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

-- ========== get_leaderboard_rank (replace to filter on paid-by-lock) ==========
create or replace function public.get_leaderboard_rank(
    p_tournament_id uuid,
    p_username citext,
    p_page_size int default 25
)
returns table (
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
            pr.username,
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
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and p.submitted_at is not null
          and exists (
              select 1
              from public.tournament_payments tp
              join public.tournaments t on t.id = tp.tournament_id
              where tp.user_id = p.user_id
                and tp.tournament_id = p.tournament_id
                and tp.paid_at <= t.lock_time
          )
    )
    select
        rank,
        ((rank - 1) / greatest(p_page_size, 1) + 1)::int as page,
        points
    from ranked
    where username = p_username;
$$;
