-- 0081_void_prediction.sql
--
-- "Void a prediction": an admin can mark a prediction voided so it is removed
-- from the competition — excluded from the leaderboard and every paid-prediction
-- count — while staying in the DB (history preserved). Reversible (un-void).
--
-- Implementation: a `predictions.voided` boolean, an admin RPC to toggle it, and
-- a `not voided` filter re-emitted into every function that ranks or counts paid
-- predictions. Functions are copied verbatim from their latest definitions with
-- only the void filter added:
--   get_leaderboard / get_leaderboard_rank        (0069)
--   get_tournament_pot_stats                      (0041)
--   admin_get_dashboard_stats                     (0043)
--   get_audit_stats                               (0056)
--   admin_list_users                              (0061)
--   get_loyalty_status / redeem_loyalty_credit    (0038)
--   referrals_sync_qualification                  (0039)
--   admin_snapshot_phase1_winners                 (0070)
-- admin_list_predictions (0062) is intentionally left unfiltered — it's a
-- moderation view that must still surface voided rows.

-- ========== column ==========
alter table public.predictions
    add column if not exists voided boolean not null default false;

-- ========== admin_set_prediction_void ==========
-- Any admin, any phase (void is a correction tool used after problems surface,
-- often post-lock). SECURITY DEFINER bypasses RLS. Because toggling `voided`
-- doesn't touch tournament_payments, the referrals_sync_qualification trigger
-- won't fire — so re-sync the owner's referral qualification here.
create or replace function public.admin_set_prediction_void(
    p_prediction_id uuid,
    p_void boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_prediction_id is null then
        raise exception 'prediction_id is required' using errcode = 'P0001';
    end if;

    update public.predictions
       set voided = p_void, updated_at = now()
     where id = p_prediction_id
     returning user_id into v_user_id;

    if not found then
        raise exception 'prediction not found' using errcode = 'P0001';
    end if;

    -- Re-sync the owner's referral qualification: do they still have any
    -- non-free, non-voided payment? Round-trips correctly on un-void.
    if exists (
        select 1 from public.tournament_payments tp
        join public.predictions pr on pr.id = tp.prediction_id
        where pr.user_id = v_user_id and tp.is_free = false and not pr.voided
    ) then
        update public.referrals
           set qualified_at = coalesce(qualified_at, (
               select min(tp.paid_at)
                 from public.tournament_payments tp
                 join public.predictions pr on pr.id = tp.prediction_id
                where pr.user_id = v_user_id and tp.is_free = false and not pr.voided
           ))
         where referee_id = v_user_id;
    else
        update public.referrals set qualified_at = null where referee_id = v_user_id;
    end if;
end;
$$;

grant execute on function public.admin_set_prediction_void(uuid, boolean) to authenticated;

-- ========== get_leaderboard (re-emitted from 0069 + void filter) ==========
create or replace function public.get_leaderboard(
    p_tournament_id uuid,
    p_page int default 1,
    p_page_size int default 25,
    p_search text default null
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
    updated_at timestamptz,
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
    search_term as (
        select nullif(trim(coalesce(p_search, '')), '') as q
    ),
    group_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when gp.first_team_id = gs.first_team_id and gp.second_team_id = gs.second_team_id
                        then case when gp.group_id = 'I' then 15 else 10 end
                    when gp.first_team_id = gs.second_team_id and gp.second_team_id = gs.first_team_id
                        then 7
                    else
                        case
                            when gp.first_team_id = gs.first_team_id then 5   -- single team, correct slot
                            when gp.second_team_id = gs.second_team_id then 5 -- single team, correct slot
                            when gp.first_team_id = gs.second_team_id then 2  -- single team, wrong slot
                            when gp.second_team_id = gs.first_team_id then 2  -- single team, wrong slot
                            else 0
                        end
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
                    when ta_rank.team_id is not null and ta_rank.team_id = ap.team_id then 2.5
                    when ta_team.team_id is not null then 2.0
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
            p.updated_at as updated_at,
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
                    p.updated_at asc nulls last
            )::int as rank
        from public.predictions p
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join advancer_scores asc_ on asc_.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and not p.voided
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
        updated_at,
        count(*) over () as total_count
    from ranked, search_term
    where search_term.q is null
       or ranked.username ilike '%' || search_term.q || '%'
       or ranked.prediction_name ilike '%' || search_term.q || '%'
    order by rank
    offset greatest(p_page - 1, 0) * greatest(p_page_size, 1)
    limit greatest(p_page_size, 1);
$$;

grant execute on function public.get_leaderboard(uuid, int, int, text) to anon, authenticated;

-- ========== get_leaderboard_rank (re-emitted from 0069 + void filter) ==========
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
                        then case when gp.group_id = 'I' then 15 else 10 end
                    when gp.first_team_id = gs.second_team_id and gp.second_team_id = gs.first_team_id
                        then 7
                    else
                        case
                            when gp.first_team_id = gs.first_team_id then 5   -- single team, correct slot
                            when gp.second_team_id = gs.second_team_id then 5 -- single team, correct slot
                            when gp.first_team_id = gs.second_team_id then 2  -- single team, wrong slot
                            when gp.second_team_id = gs.first_team_id then 2  -- single team, wrong slot
                            else 0
                        end
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
                    when ta_rank.team_id is not null and ta_rank.team_id = ap.team_id then 2.5
                    when ta_team.team_id is not null then 2.0
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
                    p.updated_at asc nulls last
            )::int as rank
        from public.predictions p
        left join group_scores gsc on gsc.prediction_id = p.id
        left join advancer_scores asc_ on asc_.prediction_id = p.id
        left join knockout_scores ksc on ksc.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and not p.voided
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

-- ========== get_tournament_pot_stats (re-emitted from 0041 + void filter) ==========
create or replace function public.get_tournament_pot_stats(p_tournament_id uuid)
returns table (
    total_entries int,
    cash_paid_count int
)
language sql
security definer
stable
set search_path = public
as $$
    select
        count(*)::int as total_entries,
        count(*) filter (where tp.is_free = false)::int as cash_paid_count
    from public.tournament_payments tp
    join public.predictions p on p.id = tp.prediction_id
    join public.tournaments t on t.id = p.tournament_id
    where p.tournament_id = p_tournament_id
      and not p.voided
      and tp.paid_at <= t.lock_time;
$$;

grant execute on function public.get_tournament_pot_stats(uuid) to anon, authenticated;

-- ========== admin_get_dashboard_stats (re-emitted from 0043 + void filter) ==========
drop function if exists public.admin_get_dashboard_stats(uuid);

create or replace function public.admin_get_dashboard_stats(p_tournament_id uuid)
returns table (
    total_registrations int,
    users_with_paid_prediction int,
    total_entries int,
    cash_paid_count int,
    free_entries int,
    referral_credits_earned int,
    referral_credits_redeemed int,
    loyalty_credits_earned int,
    loyalty_credits_redeemed int,
    top_champion_team_id text,
    top_champion_pick_count int,
    top_users jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_lock_time timestamptz;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    select t.lock_time into v_lock_time
    from public.tournaments t
    where t.id = p_tournament_id;

    return query
    with paid_per_user as (
        select p.user_id, count(*)::int as paid_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and not p.voided
          and tp.paid_at <= v_lock_time
        group by p.user_id
    ),
    cash_per_user as (
        select p.user_id, count(*)::int as cash_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and not p.voided
          and tp.is_free = false
        group by p.user_id
    ),
    referral_qualified_per_user as (
        select referrer_id, count(*)::int as qualified
        from public.referrals
        where qualified_at is not null
        group by referrer_id
    ),
    champion_picks as (
        select p.champion_team_id, count(*)::int as cnt
        from public.predictions p
        where p.tournament_id = p_tournament_id
          and p.champion_team_id is not null
        group by p.champion_team_id
        order by cnt desc, p.champion_team_id
        limit 1
    ),
    top_users_cte as (
        select
            ppu.user_id,
            ppu.paid_count,
            pr.username::text as username,
            u.email::text as email
        from paid_per_user ppu
        join public.profiles pr on pr.id = ppu.user_id
        left join auth.users u on u.id = ppu.user_id
        order by ppu.paid_count desc, pr.username
        limit 3
    )
    select
        (select count(*)::int from public.profiles)                                  as total_registrations,
        (select count(*)::int from paid_per_user)                                    as users_with_paid_prediction,
        (select coalesce(sum(paid_count), 0)::int from paid_per_user)                as total_entries,
        (select coalesce(sum(cash_count), 0)::int from cash_per_user)                as cash_paid_count,
        (select coalesce(sum(paid_count), 0)::int from paid_per_user)
            - (select coalesce(sum(cash_count), 0)::int from cash_per_user)          as free_entries,
        (select coalesce(sum(floor(qualified / 4)), 0)::int
            from referral_qualified_per_user)                                        as referral_credits_earned,
        (select count(*)::int from public.referral_redemptions)                      as referral_credits_redeemed,
        (select coalesce(sum(floor(cash_count / 5)), 0)::int from cash_per_user)     as loyalty_credits_earned,
        (select count(*)::int from public.loyalty_redemptions lr
            where lr.tournament_id = p_tournament_id)                                as loyalty_credits_redeemed,
        (select champion_team_id from champion_picks)                                as top_champion_team_id,
        (select cnt from champion_picks)                                             as top_champion_pick_count,
        coalesce(
            (select jsonb_agg(jsonb_build_object(
                'user_id', user_id,
                'username', username,
                'email', email,
                'paid_count', paid_count
            ) order by paid_count desc, username) from top_users_cte),
            '[]'::jsonb
        )                                                                            as top_users;
end;
$$;

grant execute on function public.admin_get_dashboard_stats(uuid) to authenticated;

-- ========== get_audit_stats (re-emitted from 0056 + void filter) ==========
drop function if exists public.get_audit_stats(uuid);

create or replace function public.get_audit_stats(p_tournament_id uuid)
returns table (
    total_registrations int,
    users_with_paid_prediction int,
    total_entries int,
    cash_paid_count int,
    free_entries int,
    referral_credits_redeemed int,
    loyalty_credits_redeemed int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_lock_time timestamptz;
begin
    if auth.uid() is null then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    select t.lock_time into v_lock_time
    from public.tournaments t
    where t.id = p_tournament_id;

    return query
    with paid_per_user as (
        select p.user_id, count(*)::int as paid_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and not p.voided
          and tp.paid_at <= v_lock_time
        group by p.user_id
    ),
    cash_per_user as (
        select p.user_id, count(*)::int as cash_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and not p.voided
          and tp.is_free = false
        group by p.user_id
    )
    select
        (select count(*)::int from public.profiles)                          as total_registrations,
        (select count(*)::int from paid_per_user)                            as users_with_paid_prediction,
        (select coalesce(sum(paid_count), 0)::int from paid_per_user)        as total_entries,
        (select coalesce(sum(cash_count), 0)::int from cash_per_user)        as cash_paid_count,
        (select coalesce(sum(paid_count), 0)::int from paid_per_user)
            - (select coalesce(sum(cash_count), 0)::int from cash_per_user)  as free_entries,
        (select count(*)::int from public.referral_redemptions)              as referral_credits_redeemed,
        (select count(*)::int from public.loyalty_redemptions lr
            where lr.tournament_id = p_tournament_id)                        as loyalty_credits_redeemed;
end;
$$;

grant execute on function public.get_audit_stats(uuid) to authenticated;

-- ========== admin_list_users (re-emitted from 0061 + void filter) ==========
create or replace function public.admin_list_users(
    p_search text,
    p_page int,
    p_page_size int
)
returns table (
    id uuid,
    username text,
    email text,
    is_admin boolean,
    is_super_admin boolean,
    prediction_count int,
    paid_prediction_count int,
    total_rewards int,
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
            u.email::text as email,
            p.is_admin,
            p.is_super_admin,
            coalesce(counts.prediction_count, 0)::int as prediction_count,
            coalesce(counts.paid_prediction_count, 0)::int as paid_prediction_count,
            (
                coalesce(ref.qualified_count, 0) / 4
                + coalesce(counts.cash_paid_count, 0) / 5
            )::int as total_rewards
        from public.profiles p
        left join auth.users u on u.id = p.id
        left join lateral (
            select
                count(*) as prediction_count,
                count(*) filter (
                    where exists (
                        select 1 from public.tournament_payments tp
                        where tp.prediction_id = pr.id
                    )
                ) as paid_prediction_count,
                count(*) filter (
                    where exists (
                        select 1 from public.tournament_payments tp
                        where tp.prediction_id = pr.id and tp.is_free = false
                    )
                ) as cash_paid_count
            from public.predictions pr
            where pr.user_id = p.id and pr.tournament_id = v_tournament_id
              and not pr.voided
        ) counts on true
        left join lateral (
            select count(*) as qualified_count
            from public.referrals r
            where r.referrer_id = p.id and r.qualified_at is not null
        ) ref on true
        where v_search is null
           or p.username::text ilike '%' || v_search || '%'
           or u.email::text ilike '%' || v_search || '%'
           or exists (
               select 1 from public.predictions pr
               where pr.user_id = p.id
                 and pr.tournament_id = v_tournament_id
                 and pr.prediction_name::text ilike '%' || v_search || '%'
           )
    ),
    counted as (
        select count(*) as total from filtered
    )
    select
        f.id,
        f.username,
        f.email,
        f.is_admin,
        f.is_super_admin,
        f.prediction_count,
        f.paid_prediction_count,
        f.total_rewards,
        c.total
    from filtered f
    cross join counted c
    order by f.username asc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_users(text, int, int) to authenticated;

-- ========== get_loyalty_status (re-emitted from 0038 + void filter) ==========
create or replace function public.get_loyalty_status(p_tournament_id uuid)
returns table (
    cash_paid_count   int,
    earned_credits    int,
    redeemed_credits  int,
    available_credits int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_paid int;
    v_redeemed int;
    v_earned int;
begin
    if v_user is null then
        raise exception 'not authenticated' using errcode = 'P0001';
    end if;
    if p_tournament_id is null then
        raise exception 'tournament_id is required' using errcode = 'P0001';
    end if;

    select count(*)::int
      into v_paid
      from public.tournament_payments tp
      join public.predictions pr on pr.id = tp.prediction_id
     where pr.user_id = v_user
       and pr.tournament_id = p_tournament_id
       and not pr.voided
       and tp.is_free = false;

    select count(*)::int
      into v_redeemed
      from public.loyalty_redemptions lr
     where lr.user_id = v_user
       and lr.tournament_id = p_tournament_id;

    v_earned := v_paid / 5;

    cash_paid_count   := v_paid;
    earned_credits    := v_earned;
    redeemed_credits  := v_redeemed;
    available_credits := greatest(0, v_earned - v_redeemed);
    return next;
end;
$$;

grant execute on function public.get_loyalty_status(uuid) to authenticated;

-- ========== redeem_loyalty_credit (re-emitted from 0038 + void filter) ==========
create or replace function public.redeem_loyalty_credit(p_prediction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user          uuid := auth.uid();
    v_prediction    public.predictions%rowtype;
    v_super_admin   boolean;
    v_existing_paid boolean;
    v_paid          int;
    v_redeemed      int;
    v_earned        int;
    v_payment_id    uuid;
begin
    if v_user is null then
        raise exception 'not authenticated' using errcode = 'P0001';
    end if;
    if p_prediction_id is null then
        raise exception 'prediction_id is required' using errcode = 'P0001';
    end if;

    select * into v_prediction
      from public.predictions
     where id = p_prediction_id
     for update;

    if not found then
        raise exception 'prediction not found' using errcode = 'P0001';
    end if;

    if v_prediction.user_id <> v_user then
        raise exception 'not your prediction' using errcode = 'P0001';
    end if;

    select coalesce(is_super_admin, false) into v_super_admin
      from public.profiles where id = v_user;

    if not v_super_admin and not public.is_before_lock(v_prediction.tournament_id) then
        raise exception 'predictions are locked' using errcode = 'P0001';
    end if;

    select exists(
        select 1 from public.tournament_payments
        where prediction_id = p_prediction_id
    ) into v_existing_paid;

    if v_existing_paid then
        raise exception 'prediction already paid' using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(v_user::text || ':' || v_prediction.tournament_id::text, 0)
    );

    select count(*)::int
      into v_paid
      from public.tournament_payments tp
      join public.predictions pr on pr.id = tp.prediction_id
     where pr.user_id = v_user
       and pr.tournament_id = v_prediction.tournament_id
       and not pr.voided
       and tp.is_free = false;

    select count(*)::int
      into v_redeemed
      from public.loyalty_redemptions lr
     where lr.user_id = v_user
       and lr.tournament_id = v_prediction.tournament_id;

    v_earned := v_paid / 5;

    if v_earned - v_redeemed <= 0 then
        raise exception 'no loyalty credits available' using errcode = 'P0001';
    end if;

    insert into public.loyalty_redemptions
        (user_id, tournament_id, prediction_id, cash_paid_count_at_redemption)
    values
        (v_user, v_prediction.tournament_id, p_prediction_id, v_paid);

    insert into public.tournament_payments
        (user_id, tournament_id, prediction_id, paid_at, marked_by, is_free)
    values
        (v_user, v_prediction.tournament_id, p_prediction_id, now(), v_user, true)
    returning id into v_payment_id;

    return v_payment_id;
end;
$$;

grant execute on function public.redeem_loyalty_credit(uuid) to authenticated;

-- ========== referrals_sync_qualification (re-emitted from 0039 + void filter) ==========
create or replace function public.referrals_sync_qualification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_referee_id uuid;
    v_remaining  int;
begin
    if tg_op in ('INSERT', 'UPDATE') then
        if new.is_free then
            return new;
        end if;
        select user_id into v_referee_id
          from public.predictions where id = new.prediction_id;
        if v_referee_id is null then
            return new;
        end if;
        update public.referrals
           set qualified_at = new.paid_at
         where referee_id = v_referee_id
           and qualified_at is null;
        return new;
    elsif tg_op = 'DELETE' then
        if old.is_free then
            return old;
        end if;
        select user_id into v_referee_id
          from public.predictions where id = old.prediction_id;
        if v_referee_id is null then
            return old;
        end if;
        select count(*) into v_remaining
          from public.tournament_payments tp
          join public.predictions p on p.id = tp.prediction_id
         where p.user_id = v_referee_id and tp.is_free = false and not p.voided;
        if v_remaining = 0 then
            update public.referrals
               set qualified_at = null
             where referee_id = v_referee_id;
        end if;
        return old;
    end if;
    return null;
end;
$$;

-- ========== admin_snapshot_phase1_winners (re-emitted from 0070 + void filter) ==========
create or replace function public.admin_snapshot_phase1_winners(p_tournament_id uuid)
returns setof public.phase1_winners
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden';
    end if;

    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found';
    end if;

    delete from public.phase1_winners where tournament_id = p_tournament_id;

    return query
    with group_scores as (
        select
            p.id as prediction_id,
            coalesce(sum(
                case
                    when gp.first_team_id = gs.first_team_id and gp.second_team_id = gs.second_team_id
                        then case when gp.group_id = 'I' then 15 else 10 end
                    when gp.first_team_id = gs.second_team_id and gp.second_team_id = gs.first_team_id
                        then 7
                    else
                        case
                            when gp.first_team_id = gs.first_team_id then 5   -- single team, correct slot
                            when gp.second_team_id = gs.second_team_id then 5 -- single team, correct slot
                            when gp.first_team_id = gs.second_team_id then 2  -- single team, wrong slot
                            when gp.second_team_id = gs.first_team_id then 2  -- single team, wrong slot
                            else 0
                        end
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
                    when ta_rank.team_id is not null and ta_rank.team_id = ap.team_id then 2.5
                    when ta_team.team_id is not null then 2.0
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
    ranked as (
        select
            p.id as prediction_id,
            p.prediction_name::text as prediction_name,
            pr.username::text as username,
            coalesce(gsc.group_points, 0) as group_points,
            coalesce(asc_.advancer_points, 0)::numeric as advancer_points,
            (coalesce(gsc.group_points, 0)
                + coalesce(asc_.advancer_points, 0))::numeric as phase1_points,
            p.updated_at as prediction_updated_at,
            row_number() over (
                order by
                    (coalesce(gsc.group_points, 0)
                        + coalesce(asc_.advancer_points, 0)) desc,
                    p.updated_at asc nulls last
            )::int as rank
        from public.predictions p
        join public.profiles pr on pr.id = p.user_id
        left join group_scores gsc on gsc.prediction_id = p.id
        left join advancer_scores asc_ on asc_.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and not p.voided
          and (p.submitted_at is not null or public.prediction_phase1_complete(p.id))
          and exists (
              select 1
              from public.tournament_payments tp
              join public.tournaments t on t.id = tp.tournament_id
              where tp.prediction_id = p.id
                and tp.paid_at <= t.lock_time
          )
    ),
    inserted as (
        insert into public.phase1_winners (
            tournament_id, rank, prediction_id, prediction_name, username,
            group_points, advancer_points, phase1_points, prediction_updated_at
        )
        select
            p_tournament_id, r.rank, r.prediction_id, r.prediction_name, r.username,
            r.group_points, r.advancer_points, r.phase1_points, r.prediction_updated_at
        from ranked r
        where r.rank <= 3
        returning *
    )
    select * from inserted order by rank;
end;
$$;

grant execute on function public.admin_snapshot_phase1_winners(uuid) to authenticated;
