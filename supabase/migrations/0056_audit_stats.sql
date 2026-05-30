-- 0056_audit_stats.sql
--
-- Public-facing (logged-in) transparency RPC for the /audit page. Returns the
-- PII-free subset of admin_get_dashboard_stats (0043): aggregate counts only,
-- no usernames / emails / top users / champion picks.
--
-- SECURITY DEFINER + granted to `authenticated` (NOT anon): regular users
-- can't aggregate tournament_payments / *_redemptions directly because RLS on
-- those tables is owner-scoped, so the aggregation has to run as definer.
-- The function exposes only counts, so it's safe for any signed-in user.
--
-- "Applied rewards" = redeemed free-pick credits (referral + loyalty), i.e.
-- the rows in referral_redemptions / loyalty_redemptions.

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
        -- Per-user count of paid entries (cash + free, paid before lock).
        -- Mirrors admin_get_dashboard_stats so the two surfaces agree.
        select p.user_id, count(*)::int as paid_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
          and tp.paid_at <= v_lock_time
        group by p.user_id
    ),
    cash_per_user as (
        -- Per-user count of CASH-paid entries (is_free = false) — drives revenue.
        select p.user_id, count(*)::int as cash_count
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        where p.tournament_id = p_tournament_id
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
