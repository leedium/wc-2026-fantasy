-- WC2026 — Referral program
--
-- Every user gets an auto-generated 8-character referral code at signup
-- (kept in a separate `referral_codes` table so codes aren't enumerable
-- via the public `profiles_select_all` policy). Codes can be entered via
-- /register?ref=... or a manual input. When a referred user's FIRST
-- non-free payment lands (admin marks paid), the referrer earns one
-- free-pick credit. The referrer redeems the credit on a chosen unpaid
-- prediction via the `redeem_referral_credit` RPC, which inserts a
-- `tournament_payments` row with `is_free = true`. The existing
-- leaderboard filter (`paid_at <= lock_time`) catches it unchanged.
--
-- Security properties:
--   * `referee_id` is the PK on `referrals`, so a user can only be
--     referred once (second insert fails). DB CHECK and the trigger
--     also block self-referral.
--   * `qualified_at` is set only by the trigger on tournament_payments;
--     RLS denies direct writes to `referrals` from clients. Only
--     non-free payments (is_free = false) count toward qualification.
--   * `redeem_referral_credit` runs the available-credit query with
--     `FOR UPDATE SKIP LOCKED` so two concurrent redeems can never
--     claim the same row.
--   * Clients cannot set `is_free = true` on tournament_payments — RLS
--     restricts writes to admins, and the redeem RPC is the only
--     SECURITY DEFINER path that flips the flag.
--   * `resolve_referrer_username` is SECURITY DEFINER and returns only
--     the matching username (or NULL). It's the only way for an
--     unauthenticated visitor to look up a code; rate-limit at the WAF.


-- ========== referral_codes table ==========

create table public.referral_codes (
    user_id    uuid primary key references public.profiles(id) on delete cascade,
    code       citext not null unique,
    created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

-- Users can read their own code; admins can read all. No client writes —
-- the only insert path is the handle_new_user trigger (SECURITY DEFINER).
create policy "referral_codes_select_own_or_admin"
    on public.referral_codes for select
    using (auth.uid() = user_id or public.is_admin());

-- Grant base SELECT so PostgREST consults RLS rather than returning 401.
grant select on public.referral_codes to authenticated;


-- ========== referrals table ==========

create table public.referrals (
    referee_id           uuid primary key references public.profiles(id) on delete cascade,
    referrer_id          uuid not null references public.profiles(id) on delete cascade,
    referrer_code_used   text not null,
    created_at           timestamptz not null default now(),
    qualified_at         timestamptz,
    reward_redeemed_at   timestamptz,
    reward_prediction_id uuid references public.predictions(id) on delete set null,
    constraint referrals_no_self_referral check (referee_id <> referrer_id),
    constraint referrals_reward_pair check (
        (reward_redeemed_at is null) = (reward_prediction_id is null)
    ),
    constraint referrals_reward_requires_qualified check (
        reward_redeemed_at is null or qualified_at is not null
    )
);

-- Powers credit-count lookups in get_referral_status.
create index referrals_referrer_credits_idx
    on public.referrals (referrer_id, qualified_at, reward_redeemed_at);

alter table public.referrals enable row level security;

-- Admin-only direct reads. End-users get their data via
-- get_referral_status (aggregates) so the friend list isn't exposed.
create policy "referrals_admin_select"
    on public.referrals for select
    using (public.is_admin());

-- No client writes — all mutations go through SECURITY DEFINER paths.


-- ========== tournament_payments.is_free ==========

alter table public.tournament_payments
    add column if not exists is_free boolean not null default false;

-- Helpful for "list all free redemptions" admin queries.
create index tournament_payments_is_free_idx
    on public.tournament_payments (is_free) where is_free;


-- ========== Code generation helper ==========
-- 8 chars from a 31-char alphabet (no 0/O/1/I/L) → ~31^8 ≈ 8.5×10^11 codes.
-- Function is IMMUTABLE-ish in spirit but uses random(), so VOLATILE.
create or replace function public.generate_referral_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
    alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    out text := '';
    i int;
begin
    for i in 1..8 loop
        out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    return out;
end;
$$;


-- ========== Backfill referral_codes for existing profiles ==========
do $$
declare
    target uuid;
    candidate text;
    attempts int;
begin
    for target in
        select p.id
        from public.profiles p
        left join public.referral_codes rc on rc.user_id = p.id
        where rc.user_id is null
    loop
        attempts := 0;
        loop
            candidate := public.generate_referral_code();
            begin
                insert into public.referral_codes (user_id, code)
                values (target, candidate);
                exit;
            exception when unique_violation then
                attempts := attempts + 1;
                if attempts >= 20 then
                    raise exception 'could not backfill referral_code for %', target;
                end if;
            end;
        end loop;
    end loop;
end $$;


-- ========== handle_new_user — generate code + capture referrer ==========
-- Replaces the version in 0015_multi_prediction_rpcs.sql. Additions:
--   * After profile insert, generate + insert a referral_code (10-attempt
--     collision retry, mirroring the username pattern).
--   * If `raw_user_meta_data.referral_code` is present, resolve it to a
--     referrer and insert a referrals row. Invalid or self-referral codes
--     are silently ignored — we never fail signup over a bad invite link.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    meta_username text;
    meta_referral text;
    candidate     text;
    attempts      int := 0;
    referrer_uuid uuid;
begin
    meta_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
    meta_referral := nullif(trim(new.raw_user_meta_data->>'referral_code'), '');

    if meta_username is not null then
        begin
            insert into public.profiles (id, username) values (new.id, meta_username);
        exception
            when unique_violation then
                raise exception 'username taken' using errcode = 'P0001';
            when check_violation then
                raise exception 'username invalid format' using errcode = 'P0001';
        end;
    else
        loop
            candidate := 'user_' || encode(extensions.gen_random_bytes(4), 'hex');
            begin
                insert into public.profiles (id, username) values (new.id, candidate);
                exit;
            exception when unique_violation then
                attempts := attempts + 1;
                if attempts >= 10 then
                    raise exception 'could not generate unique username' using errcode = 'P0001';
                end if;
            end;
        end loop;
    end if;

    -- Generate this user's own referral code (separate retry counter).
    attempts := 0;
    loop
        candidate := public.generate_referral_code();
        begin
            insert into public.referral_codes (user_id, code) values (new.id, candidate);
            exit;
        exception when unique_violation then
            attempts := attempts + 1;
            if attempts >= 10 then
                raise exception 'could not generate unique referral_code' using errcode = 'P0001';
            end if;
        end;
    end loop;

    -- Capture inbound referral if a valid, non-self code was provided.
    if meta_referral is not null then
        select user_id into referrer_uuid
        from public.referral_codes
        where code = meta_referral;

        if referrer_uuid is not null and referrer_uuid <> new.id then
            insert into public.referrals (referee_id, referrer_id, referrer_code_used)
            values (new.id, referrer_uuid, meta_referral);
            -- No exception handler needed: referee_id PK + check constraint
            -- guarantee a clean insert; concurrency is single-row per new.id.
        end if;
    end if;

    return new;
end;
$$;


-- ========== Qualification trigger on tournament_payments ==========
-- INSERT/UPDATE: if the underlying prediction belongs to a referee whose
-- referral row is not yet qualified, set qualified_at to the payment's
-- paid_at. Free-credit payments (is_free = true) do NOT count — only
-- real money qualifies the referrer.
-- DELETE: if the referee has no remaining non-free payments AND the
-- referrer has not yet redeemed the credit, revert qualified_at to NULL
-- so the menu/banner disappear.

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
                where referee_id = v_referee_id
                  and reward_redeemed_at is null;
        end if;
        return old;
    end if;
    return null;
end;
$$;

drop trigger if exists tournament_payments_sync_referrals on public.tournament_payments;
create trigger tournament_payments_sync_referrals
    after insert or update or delete on public.tournament_payments
    for each row execute function public.referrals_sync_qualification();


-- ========== RPC: get_referral_status ==========
-- Caller-scoped. Returns code + aggregate counts; never leaks the
-- referee usernames (use admin_list_user_referrals for moderation).
create or replace function public.get_referral_status()
returns table (
    referral_code      text,
    available_credits  int,
    qualified_total    int,
    redeemed_total     int
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated' using errcode = 'P0001';
    end if;
    return query
    select
        (select rc.code::text from public.referral_codes rc where rc.user_id = auth.uid()),
        coalesce(sum(case when r.qualified_at is not null and r.reward_redeemed_at is null then 1 else 0 end), 0)::int,
        coalesce(sum(case when r.qualified_at is not null then 1 else 0 end), 0)::int,
        coalesce(sum(case when r.reward_redeemed_at is not null then 1 else 0 end), 0)::int
    from public.referrals r
    where r.referrer_id = auth.uid();
end;
$$;

grant execute on function public.get_referral_status() to authenticated;


-- ========== RPC: resolve_referrer_username ==========
-- Powers /api/referrals/validate. Returns NULL for invalid codes.
-- SECURITY DEFINER so anon callers (pre-signup) bypass RLS on
-- referral_codes. Rate-limit at the Cloudflare WAF layer.
create or replace function public.resolve_referrer_username(p_code text)
returns text
language sql
security definer
stable
set search_path = public
as $$
    select p.username::text
    from public.referral_codes rc
    join public.profiles p on p.id = rc.user_id
    where rc.code = nullif(trim(p_code), '');
$$;

grant execute on function public.resolve_referrer_username(text) to anon, authenticated;


-- ========== RPC: redeem_referral_credit ==========
-- Atomically: lock one available referral, insert a free
-- tournament_payments row, mark the referral redeemed.
-- Returns the new payment's id.
create or replace function public.redeem_referral_credit(p_prediction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user           uuid := auth.uid();
    v_prediction     public.predictions%rowtype;
    v_existing_paid  boolean;
    v_referral_id    uuid;
    v_payment_id     uuid;
    v_super_admin    boolean;
begin
    if v_user is null then
        raise exception 'not authenticated' using errcode = 'P0001';
    end if;
    if p_prediction_id is null then
        raise exception 'prediction_id is required' using errcode = 'P0001';
    end if;

    -- Lock the prediction row so a concurrent payment insert can't sneak
    -- in between our existence check and the insert.
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

    -- Super admins can bypass lock (matches submit_predictions semantics).
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

    -- Claim one available credit. FOR UPDATE SKIP LOCKED is what makes
    -- concurrent redeems safe — each transaction picks a different row.
    select referee_id into v_referral_id
    from public.referrals
    where referrer_id = v_user
      and qualified_at is not null
      and reward_redeemed_at is null
    order by qualified_at
    limit 1
    for update skip locked;

    if v_referral_id is null then
        raise exception 'no referral credits available' using errcode = 'P0001';
    end if;

    -- Issue the free payment. marked_by = the redeemer themselves; admin
    -- listings can distinguish via is_free.
    insert into public.tournament_payments
        (user_id, tournament_id, prediction_id, paid_at, marked_by, is_free)
    values
        (v_user, v_prediction.tournament_id, p_prediction_id, now(), v_user, true)
    returning id into v_payment_id;

    update public.referrals
        set reward_redeemed_at = now(),
            reward_prediction_id = p_prediction_id
        where referee_id = v_referral_id;

    return v_payment_id;
end;
$$;

grant execute on function public.redeem_referral_credit(uuid) to authenticated;


-- ========== RPC: admin_list_user_referrals ==========
-- Moderation view: who did this user refer, and where are they in the
-- qualification → redemption lifecycle? Also returns the inbound row
-- (who referred *them*) for context.
create or replace function public.admin_list_user_referrals(p_user_id uuid)
returns table (
    direction              text,
    referee_id             uuid,
    referee_username       text,
    referrer_id            uuid,
    referrer_username      text,
    referrer_code_used     text,
    created_at             timestamptz,
    qualified_at           timestamptz,
    reward_redeemed_at     timestamptz,
    reward_prediction_id   uuid
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
        r.qualified_at,
        r.reward_redeemed_at,
        r.reward_prediction_id
    from public.referrals r
    join public.profiles ree on ree.id = r.referee_id
    join public.profiles rer on rer.id = r.referrer_id
    where r.referrer_id = p_user_id or r.referee_id = p_user_id
    order by r.created_at desc;
end;
$$;

grant execute on function public.admin_list_user_referrals(uuid) to authenticated;
