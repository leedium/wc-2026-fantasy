-- WC2026 — Referrals: 1-per-4 threshold (aggregate credit model)
--
-- Pivot from the 1:1 row-per-credit model in 0035_referrals.sql to a
-- derived earning model mirroring 0038_loyalty_credits.sql:
--
--   qualified_total = count of referrals rows with qualified_at set
--   earned_credits  = qualified_total / 4  (integer division)
--   redeemed_count  = rows in referral_redemptions for this user
--   available       = greatest(0, earned_credits - redeemed_count)
--
-- The `referrals` table stays the social-graph ledger; the legacy
-- `reward_redeemed_at` / `reward_prediction_id` columns are dropped because
-- redemptions are no longer attributable to a single referee row. A new
-- `referral_redemptions` table is the per-credit ledger.
--
-- Trigger simplification: the DELETE branch of referrals_sync_qualification
-- no longer guards against revert-after-redeem, because there's no per-row
-- redeem flag anymore. The greatest(0, ...) clamp on available_credits
-- absorbs the rare clawback-after-redeem case (already-redeemed credits
-- stay sticky; no negative balances surface).


-- ========== referral_redemptions table ==========

create table public.referral_redemptions (
    id                                  uuid primary key default gen_random_uuid(),
    user_id                             uuid not null references auth.users(id) on delete cascade,
    prediction_id                       uuid not null unique references public.predictions(id) on delete cascade,
    redeemed_at                         timestamptz not null default now(),
    qualified_count_at_redemption       int not null
);

create index referral_redemptions_user_idx
    on public.referral_redemptions (user_id);

alter table public.referral_redemptions enable row level security;

-- Users can read their own ledger; admins can read all. No client writes —
-- the only insert path is redeem_referral_credit (SECURITY DEFINER).
create policy "referral_redemptions_select_own_or_admin"
    on public.referral_redemptions for select
    using (auth.uid() = user_id or public.is_admin());

grant select on public.referral_redemptions to authenticated;


-- ========== Drop legacy redeem columns from referrals ==========

alter table public.referrals
    drop constraint if exists referrals_reward_pair,
    drop constraint if exists referrals_reward_requires_qualified;

drop index if exists public.referrals_referrer_credits_idx;

alter table public.referrals
    drop column if exists reward_redeemed_at,
    drop column if exists reward_prediction_id;

create index referrals_referrer_qualified_idx
    on public.referrals (referrer_id, qualified_at);


-- ========== RPC: get_referral_status (replacement) ==========
-- Aggregate-model: earned = floor(qualified_total / 4), available clamped
-- to >= 0. Adds the `earned_credits` column so the UI can render progress
-- toward the next free pick without recomputing the threshold client-side.

drop function if exists public.get_referral_status();

create function public.get_referral_status()
returns table (
    referral_code      text,
    qualified_total    int,
    earned_credits     int,
    redeemed_total     int,
    available_credits  int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_user      uuid := auth.uid();
    v_code      text;
    v_qualified int;
    v_redeemed  int;
    v_earned    int;
begin
    if v_user is null then
        raise exception 'not authenticated' using errcode = 'P0001';
    end if;

    select rc.code::text into v_code
      from public.referral_codes rc
     where rc.user_id = v_user;

    select coalesce(sum(case when r.qualified_at is not null then 1 else 0 end), 0)::int
      into v_qualified
      from public.referrals r
     where r.referrer_id = v_user;

    select count(*)::int
      into v_redeemed
      from public.referral_redemptions rr
     where rr.user_id = v_user;

    v_earned := v_qualified / 4;

    referral_code     := v_code;
    qualified_total   := v_qualified;
    earned_credits    := v_earned;
    redeemed_total    := v_redeemed;
    available_credits := greatest(0, v_earned - v_redeemed);
    return next;
end;
$$;

grant execute on function public.get_referral_status() to authenticated;


-- ========== RPC: redeem_referral_credit (aggregate-model replacement) ==========
-- Mirrors redeem_loyalty_credit: advisory-lock the user, recompute
-- available inside the lock, insert ledger row + free tournament_payments.
-- Lifetime-scoped (no tournament_id in the lock key) because the referral
-- earning side is lifetime-scoped.

create or replace function public.redeem_referral_credit(p_prediction_id uuid)
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
    v_qualified     int;
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

    -- Super admins bypass lock (matches submit_predictions / redeem_loyalty_credit).
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

    -- Serialize this user's referral-credit redemptions. Lifetime-scoped,
    -- so the lock key is just the user.
    perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

    select coalesce(sum(case when r.qualified_at is not null then 1 else 0 end), 0)::int
      into v_qualified
      from public.referrals r
     where r.referrer_id = v_user;

    select count(*)::int
      into v_redeemed
      from public.referral_redemptions rr
     where rr.user_id = v_user;

    v_earned := v_qualified / 4;

    if v_earned - v_redeemed <= 0 then
        raise exception 'no referral credits available' using errcode = 'P0001';
    end if;

    insert into public.referral_redemptions
        (user_id, prediction_id, qualified_count_at_redemption)
    values
        (v_user, p_prediction_id, v_qualified);

    insert into public.tournament_payments
        (user_id, tournament_id, prediction_id, paid_at, marked_by, is_free)
    values
        (v_user, v_prediction.tournament_id, p_prediction_id, now(), v_user, true)
    returning id into v_payment_id;

    return v_payment_id;
end;
$$;

grant execute on function public.redeem_referral_credit(uuid) to authenticated;


-- ========== Trigger: simplify revert logic ==========
-- The old DELETE branch guarded against reverting qualified_at when a
-- per-row credit had already been redeemed. With the aggregate model
-- there's no per-row binding, so always clear qualified_at when the
-- referee's last non-free payment goes away. The greatest(0, ...) clamp
-- in get_referral_status absorbs the rare post-redeem clawback (the
-- redeemed credit stays sticky as a free tournament_payments row).

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
         where p.user_id = v_referee_id and tp.is_free = false;
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


-- ========== RPC: get_rewards_status (replacement) ==========
-- Adds referral_earned so the UI can render "progress toward next free
-- pick" (qualified_total % 4) without recomputing the threshold client-side.

drop function if exists public.get_rewards_status(uuid);

create function public.get_rewards_status(p_tournament_id uuid)
returns table (
    referral_code        text,
    total_available      int,
    referral_available   int,
    referral_qualified   int,
    referral_earned      int,
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
    v_ref_qualified int;
    v_ref_earned    int;
    v_ref_redeemed  int;
    v_ref_available int;
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

    select r.referral_code, r.qualified_total, r.earned_credits, r.redeemed_total, r.available_credits
      into v_ref_code, v_ref_qualified, v_ref_earned, v_ref_redeemed, v_ref_available
      from public.get_referral_status() r;

    select l.cash_paid_count, l.earned_credits, l.redeemed_credits, l.available_credits
      into v_loy_cash, v_loy_earned, v_loy_redeemed, v_loy_available
      from public.get_loyalty_status(p_tournament_id) l;

    referral_code      := v_ref_code;
    referral_available := coalesce(v_ref_available, 0);
    referral_qualified := coalesce(v_ref_qualified, 0);
    referral_earned    := coalesce(v_ref_earned, 0);
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


-- ========== RPC: admin_list_user_referrals (replacement) ==========
-- Drop reward_redeemed_at / reward_prediction_id columns from the return
-- shape — they no longer exist on referrals. Admins can query
-- public.referral_redemptions directly for the redemption ledger.

drop function if exists public.admin_list_user_referrals(uuid);

create function public.admin_list_user_referrals(p_user_id uuid)
returns table (
    direction            text,
    referee_id           uuid,
    referee_username     text,
    referrer_id          uuid,
    referrer_username    text,
    referrer_code_used   text,
    created_at           timestamptz,
    qualified_at         timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    return query
    select
        case when r.referrer_id = p_user_id then 'outbound' else 'inbound' end::text,
        r.referee_id,
        ree.username::text,
        r.referrer_id,
        rer.username::text,
        r.referrer_code_used,
        r.created_at,
        r.qualified_at
      from public.referrals r
      join public.profiles ree on ree.id = r.referee_id
      join public.profiles rer on rer.id = r.referrer_id
     where r.referrer_id = p_user_id or r.referee_id = p_user_id
     order by r.created_at desc;
end;
$$;

grant execute on function public.admin_list_user_referrals(uuid) to authenticated;
