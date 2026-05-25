-- 0043_admin_dashboard_stats.sql
--
-- Single SECURITY DEFINER RPC that returns every aggregate the
-- admin landing-page dashboard needs in one round-trip. Mirrors the
-- pattern of admin_list_users / admin_get_leaderboard: is_admin()
-- guard, grant to `authenticated`, RPC enforces auth itself.
--
-- Scoped to one tournament for entries / loyalty / champion-pick
-- aggregates. Referral aggregates are lifetime (referrals.qualified_at
-- is tournament-agnostic). Top users are scoped to the requested
-- tournament's paid entries.

drop function if exists public.admin_get_dashboard_stats(uuid);

create or replace function public.admin_get_dashboard_stats(p_tournament_id uuid)
returns table (
    -- Users
    total_registrations int,
    users_with_paid_prediction int,

    -- Entries
    total_entries int,
    cash_paid_count int,
    free_entries int,

    -- Rewards (system-wide)
    referral_credits_earned int,
    referral_credits_redeemed int,
    loyalty_credits_earned int,
    loyalty_credits_redeemed int,

    -- Engagement
    top_champion_team_id text,
    top_champion_pick_count int,

    -- Top 3 users by paid prediction count, as
    -- [{ user_id, username, email, paid_count }, ...]
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
        -- Per-user count of paid entries in the active tournament
        -- (cash + free, paid before lock).
        select p.user_id, count(*)::int as paid_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and tp.paid_at <= v_lock_time
        group by p.user_id
    ),
    cash_per_user as (
        -- Per-user count of CASH-paid entries (drives loyalty earning).
        select p.user_id, count(*)::int as cash_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and tp.is_free = false
        group by p.user_id
    ),
    referral_qualified_per_user as (
        -- Per-referrer count of referees that have paid for real.
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
