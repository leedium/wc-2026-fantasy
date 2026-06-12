-- Allow super admins to mark a prediction as a comped FREE entry.
--
-- Use case: a referrer earned a referral free-pick, but the qualifying referee
-- paid after lock. The normal redeem flow (redeem_free_pick) is caller-scoped
-- and stamps paid_at = now(), so a post-lock redemption fails the leaderboard
-- eligibility check (paid_at <= lock_time). This adds a super-admin-only path to
-- grant a free (is_free = true) entry with a backdated paid_at so it ranks.
--
-- "Mark Free" = "Mark Paid, but tagged is_free = true" — keeps the books honest
-- (dashboard splits cash_paid_count vs free_entries) and implies no cash changed
-- hands. This is a pure comp: it does NOT touch the referral/loyalty ledgers, so
-- the referrer's available_credits is unaffected.
--
-- Re-emits admin_set_prediction_payment (last in 0066) with a new optional
-- p_is_free param. Adding a param creates a new overload, so the old 3-arg
-- version is dropped first to avoid an ambiguous-overload error on existing
-- 3-named-arg PostgREST calls. Body is identical to 0066 except for the
-- is_free wiring + the super-admin gate on free entries.

drop function if exists public.admin_set_prediction_payment(uuid, boolean, timestamptz);

create or replace function public.admin_set_prediction_payment(
    p_prediction_id uuid,
    p_paid boolean,
    p_paid_at timestamptz default null,
    p_is_free boolean default false
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

    -- Comped free entries are a super-admin-only action, regardless of lock.
    if p_is_free and not public.is_super_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    select user_id, tournament_id
      into v_user_id, v_tournament_id
      from public.predictions
     where id = p_prediction_id;

    if not found then
        raise exception 'prediction not found' using errcode = 'P0001';
    end if;

    -- Past lock, only super admins may change payment state. This prevents
    -- late (or backdated) payments from surfacing on the leaderboard.
    if not public.is_super_admin() and not public.is_before_lock(v_tournament_id) then
        raise exception 'payments are locked' using errcode = 'P0001';
    end if;

    if p_paid then
        insert into public.tournament_payments (user_id, tournament_id, prediction_id, paid_at, marked_by, is_free)
        values (v_user_id, v_tournament_id, p_prediction_id, v_paid_at, auth.uid(), p_is_free)
        on conflict (prediction_id) do update
            set paid_at = excluded.paid_at,
                marked_by = excluded.marked_by,
                is_free = excluded.is_free;
    else
        delete from public.tournament_payments where prediction_id = p_prediction_id;
    end if;
end;
$$;

grant execute on function public.admin_set_prediction_payment(uuid, boolean, timestamptz, boolean) to authenticated;
