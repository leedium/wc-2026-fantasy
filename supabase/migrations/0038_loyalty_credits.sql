-- WC2026 — Loyalty rewards (high-volume free picks)
--
-- Every 5 cash-paid predictions a user has in a tournament grants them 1
-- free-pick credit redeemable on an unpaid prediction in that same tournament.
-- Mirrors the referral free-pick lifecycle (writes a tournament_payments row
-- with is_free = true), but with a derived-count earning model rather than a
-- materialized "earned" row per credit:
--
--   paid_cash_count = count of tournament_payments for this user+tournament
--                     where is_free = false
--   earned_credits  = floor(paid_cash_count / 5)
--   redeemed_count  = rows in loyalty_redemptions for this user+tournament
--   available       = greatest(0, earned_credits - redeemed_count)
--
-- The `loyalty_redemptions` table is just the redemption ledger — the earning
-- side stays derivable from tournament_payments so an admin reversing a cash
-- payment naturally drops the user's `available` count (the redeemed credit
-- stays sticky if already cashed, matching the referral convention).
--
-- Security properties:
--   * Free picks earned through loyalty do NOT count toward the next 5 —
--     the count is gated on `is_free = false`, matching the referral
--     qualification trigger's same rule.
--   * `loyalty_redemptions` has RLS enabled with own-or-admin SELECT and no
--     client writes; the only insert path is `redeem_loyalty_credit`
--     (SECURITY DEFINER).
--   * Concurrent redeem calls are serialized via a per-user, per-tournament
--     transactional advisory lock so the check-then-insert can't double-spend.
--   * The unifying wrappers `get_rewards_status` and `redeem_free_pick` are
--     the client-facing API; the per-source RPCs stay as internal building
--     blocks. `redeem_free_pick` prefers referrals first (slower to acquire)
--     so the user's own paying activity keeps generating loyalty credits at
--     the same rate.


-- ========== loyalty_redemptions table ==========

create table public.loyalty_redemptions (
    id                             uuid primary key default gen_random_uuid(),
    user_id                        uuid not null references auth.users(id) on delete cascade,
    tournament_id                  uuid not null references public.tournaments(id) on delete cascade,
    prediction_id                  uuid not null unique references public.predictions(id) on delete cascade,
    redeemed_at                    timestamptz not null default now(),
    cash_paid_count_at_redemption  int not null
);

create index loyalty_redemptions_user_tournament_idx
    on public.loyalty_redemptions (user_id, tournament_id);

alter table public.loyalty_redemptions enable row level security;

-- Users can read their own ledger; admins can read all. No client writes —
-- the only insert path is redeem_loyalty_credit (SECURITY DEFINER).
create policy "loyalty_redemptions_select_own_or_admin"
    on public.loyalty_redemptions for select
    using (auth.uid() = user_id or public.is_admin());

grant select on public.loyalty_redemptions to authenticated;


-- ========== RPC: get_loyalty_status ==========
-- Caller-scoped, per-tournament aggregates. Used by get_rewards_status; not
-- exposed to the client directly.
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


-- ========== RPC: redeem_loyalty_credit ==========
-- Atomically: lock prediction row, take a per-user+tournament advisory lock,
-- recompute available_credits, insert into the ledger, insert a free
-- tournament_payments row.
--
-- Why an advisory lock instead of FOR UPDATE SKIP LOCKED (as referrals use)?
-- Loyalty has no row-per-credit pool to lock against — the count is derived.
-- Two concurrent redeems from the same user could each read the same `paid`
-- count and both succeed. The advisory lock (scoped to user+tournament)
-- serializes only this user's redemptions; unrelated users are unaffected.
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

    -- Lock the prediction so a concurrent payment insert can't sneak in.
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

    -- Super admins bypass lock (matches submit_predictions / redeem_referral_credit semantics).
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

    -- Serialize this user's redemptions for this tournament. Two concurrent
    -- redeem calls against different unpaid predictions when only 1 credit
    -- is available: the second one blocks here, then sees available = 0 and
    -- raises.
    perform pg_advisory_xact_lock(
        hashtextextended(v_user::text || ':' || v_prediction.tournament_id::text, 0)
    );

    select count(*)::int
      into v_paid
      from public.tournament_payments tp
      join public.predictions pr on pr.id = tp.prediction_id
     where pr.user_id = v_user
       and pr.tournament_id = v_prediction.tournament_id
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


-- ========== RPC: get_rewards_status ==========
-- Single client-facing read. Merges referral + loyalty into one flat shape
-- consumed by /api/rewards/status + useRewardsStatus.
create or replace function public.get_rewards_status(p_tournament_id uuid)
returns table (
    referral_code        text,
    total_available      int,
    referral_available   int,
    referral_qualified   int,
    referral_redeemed    int,
    loyalty_available    int,
    loyalty_earned       int,
    loyalty_redeemed     int,
    loyalty_cash_paid    int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_ref_code      text;
    v_ref_available int;
    v_ref_qualified int;
    v_ref_redeemed  int;
    v_loy_cash      int;
    v_loy_earned    int;
    v_loy_redeemed  int;
    v_loy_available int;
begin
    if auth.uid() is null then
        raise exception 'not authenticated' using errcode = 'P0001';
    end if;
    if p_tournament_id is null then
        raise exception 'tournament_id is required' using errcode = 'P0001';
    end if;

    select r.referral_code, r.available_credits, r.qualified_total, r.redeemed_total
      into v_ref_code, v_ref_available, v_ref_qualified, v_ref_redeemed
      from public.get_referral_status() r;

    select l.cash_paid_count, l.earned_credits, l.redeemed_credits, l.available_credits
      into v_loy_cash, v_loy_earned, v_loy_redeemed, v_loy_available
      from public.get_loyalty_status(p_tournament_id) l;

    referral_code      := v_ref_code;
    referral_available := coalesce(v_ref_available, 0);
    referral_qualified := coalesce(v_ref_qualified, 0);
    referral_redeemed  := coalesce(v_ref_redeemed, 0);

    loyalty_available  := coalesce(v_loy_available, 0);
    loyalty_earned     := coalesce(v_loy_earned, 0);
    loyalty_redeemed   := coalesce(v_loy_redeemed, 0);
    loyalty_cash_paid  := coalesce(v_loy_cash, 0);

    total_available    := referral_available + loyalty_available;
    return next;
end;
$$;

grant execute on function public.get_rewards_status(uuid) to authenticated;


-- ========== RPC: redeem_free_pick ==========
-- Single client-facing write. Tries referral first (slower to acquire), then
-- loyalty. Returns the new payment id + which source was consumed so the
-- client can show source-attributed feedback.
create or replace function public.redeem_free_pick(p_prediction_id uuid)
returns table (
    payment_id uuid,
    source     text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_payment uuid;
begin
    -- Try referral first.
    begin
        v_payment := public.redeem_referral_credit(p_prediction_id);
        payment_id := v_payment;
        source := 'referral';
        return next;
        return;
    exception when others then
        -- Only swallow the "no credits" case; everything else propagates.
        if sqlerrm = 'no referral credits available' then
            -- fall through to loyalty
            null;
        else
            raise;
        end if;
    end;

    -- Fall back to loyalty.
    begin
        v_payment := public.redeem_loyalty_credit(p_prediction_id);
        payment_id := v_payment;
        source := 'loyalty';
        return next;
        return;
    exception when others then
        if sqlerrm = 'no loyalty credits available' then
            raise exception 'no free picks available' using errcode = 'P0001';
        else
            raise;
        end if;
    end;
end;
$$;

grant execute on function public.redeem_free_pick(uuid) to authenticated;
