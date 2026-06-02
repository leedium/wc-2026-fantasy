-- WC2026 — Referral Admin tool
--
-- Lets admins retroactively credit referrers whose referees signed up via a
-- bare URL (emailed contact lists) instead of a `?ref=<code>` link, so no
-- `referrals` row was ever created. There is no admin write path into
-- `referrals` today (admin-SELECT RLS only; all mutations go through
-- SECURITY DEFINER triggers), so this migration adds the missing path.
--
-- Design (no new credit concept): admins only *link* / *unlink* referee
-- accounts. The existing derived math takes over —
--   qualified_total = count of referrals rows with qualified_at set
--   earned          = floor(qualified_total / 4)
--   available       = greatest(0, earned - redeemed)
-- A referee becomes qualified on their first non-free payment.
--
-- Correctness subtlety: the tournament_payments_sync_referrals trigger only
-- fires on payment writes, so it will NOT retroactively qualify a referee who
-- already paid *before* being linked. admin_add_referral therefore backfills
-- qualified_at itself when the referee already has a non-free payment (using
-- that payment's paid_at). Not-yet-paid referees keep qualified_at NULL and
-- the existing trigger qualifies them on their first payment.
--
-- Source marker: admin-applied rows store referrer_code_used = 'ADMIN' (a
-- 5-char sentinel; organic codes are 8 chars, so no collision) so the tool
-- can distinguish organic vs admin-applied links in the UI and audit math.
--
-- Audit: every add/remove records the actor, action, targets, a snapshot of
-- the referee email, and a required free-text proof/reason note.


-- ========== referral_admin_audit table ==========

create table public.referral_admin_audit (
    id            uuid primary key default gen_random_uuid(),
    actor_id      uuid references public.profiles(id) on delete set null,
    action        text not null check (action in ('add', 'remove')),
    referrer_id   uuid references public.profiles(id) on delete set null,
    referee_id    uuid references public.profiles(id) on delete set null,
    referee_email text,
    note          text not null,
    created_at    timestamptz not null default now()
);

create index referral_admin_audit_referrer_idx
    on public.referral_admin_audit (referrer_id, created_at desc);
create index referral_admin_audit_referee_idx
    on public.referral_admin_audit (referee_id, created_at desc);

alter table public.referral_admin_audit enable row level security;

-- Admin-only reads; no INSERT policy — writes go through the SECURITY DEFINER
-- RPCs below only.
create policy "referral_admin_audit_admin_select"
    on public.referral_admin_audit for select
    using (public.is_admin());

grant select on public.referral_admin_audit to authenticated;


-- ========== RPC: admin_resolve_referee ==========
-- Powers the "Apply a referral" dialog's live email resolution. Returns the
-- matching account (if any) plus whether it has a non-free payment and who,
-- if anyone, already referred it — so the UI can preview the consequence
-- before the admin commits. SECURITY DEFINER so it can read auth.users.

create function public.admin_resolve_referee(p_email text)
returns table (
    referee_id                uuid,
    username                  text,
    has_paid                  boolean,
    current_referrer_id       uuid,
    current_referrer_username text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_email text := lower(nullif(trim(p_email), ''));
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if v_email is null then
        return;
    end if;

    return query
    select
        p.id,
        p.username::text,
        exists (
            select 1
              from public.tournament_payments tp
              join public.predictions pr on pr.id = tp.prediction_id
             where pr.user_id = p.id and tp.is_free = false
        ),
        r.referrer_id,
        rer.username::text
      from auth.users u
      join public.profiles p on p.id = u.id
      left join public.referrals r on r.referee_id = p.id
      left join public.profiles rer on rer.id = r.referrer_id
     where lower(u.email) = v_email;
end;
$$;

grant execute on function public.admin_resolve_referee(text) to authenticated;


-- ========== RPC: admin_add_referral ==========
-- Links an existing referee account to a referrer. Backfills qualified_at if
-- the referee already paid (the trigger won't re-fire for past payments).

create function public.admin_add_referral(
    p_referrer_id uuid,
    p_referee_email text,
    p_note text
)
returns table (
    referee_id uuid,
    qualified  boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_note     text := nullif(trim(p_note), '');
    v_email    text := lower(nullif(trim(p_referee_email), ''));
    v_referee  uuid;
    v_paid_at  timestamptz;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if v_note is null then
        raise exception 'note is required' using errcode = 'P0001';
    end if;

    if not exists (select 1 from public.profiles where id = p_referrer_id) then
        raise exception 'referrer not found' using errcode = 'P0001';
    end if;

    select p.id into v_referee
      from auth.users u
      join public.profiles p on p.id = u.id
     where lower(u.email) = v_email;

    if v_referee is null then
        raise exception 'referee account not found' using errcode = 'P0001';
    end if;
    if v_referee = p_referrer_id then
        raise exception 'cannot refer self' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.referrals where public.referrals.referee_id = v_referee) then
        raise exception 'referee already referred' using errcode = 'P0001';
    end if;

    -- Backfill qualification from the earliest existing non-free payment.
    select min(tp.paid_at) into v_paid_at
      from public.tournament_payments tp
      join public.predictions pr on pr.id = tp.prediction_id
     where pr.user_id = v_referee and tp.is_free = false;

    insert into public.referrals (referee_id, referrer_id, referrer_code_used, qualified_at)
    values (v_referee, p_referrer_id, 'ADMIN', v_paid_at);

    insert into public.referral_admin_audit
        (actor_id, action, referrer_id, referee_id, referee_email, note)
    values
        (auth.uid(), 'add', p_referrer_id, v_referee, v_email, v_note);

    referee_id := v_referee;
    qualified  := v_paid_at is not null;
    return next;
end;
$$;

grant execute on function public.admin_add_referral(uuid, text, text) to authenticated;


-- ========== RPC: admin_remove_referral ==========
-- Unlinks a referee. Already-redeemed credits stay sticky: the greatest(0, …)
-- clamp in get_referral_status absorbs the post-redeem clawback.

create function public.admin_remove_referral(
    p_referee_id uuid,
    p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_note     text := nullif(trim(p_note), '');
    v_referrer uuid;
    v_email    text;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if v_note is null then
        raise exception 'note is required' using errcode = 'P0001';
    end if;

    select r.referrer_id into v_referrer
      from public.referrals r
     where r.referee_id = p_referee_id;

    if v_referrer is null then
        raise exception 'referral not found' using errcode = 'P0001';
    end if;

    select lower(u.email) into v_email from auth.users u where u.id = p_referee_id;

    delete from public.referrals where referee_id = p_referee_id;

    insert into public.referral_admin_audit
        (actor_id, action, referrer_id, referee_id, referee_email, note)
    values
        (auth.uid(), 'remove', v_referrer, p_referee_id, v_email, v_note);
end;
$$;

grant execute on function public.admin_remove_referral(uuid, text) to authenticated;


-- ========== RPC: admin_referral_overview ==========
-- Admin-scoped twin of get_referral_status for an arbitrary user, plus a
-- referee_count so the tool can render a summary band for any member.

create function public.admin_referral_overview(p_user_id uuid)
returns table (
    referral_code     text,
    qualified_total   int,
    earned_credits    int,
    redeemed_total    int,
    available_credits int,
    referee_count     int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_code      text;
    v_qualified int;
    v_redeemed  int;
    v_earned    int;
    v_count     int;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    select rc.code::text into v_code
      from public.referral_codes rc
     where rc.user_id = p_user_id;

    select
        coalesce(sum(case when r.qualified_at is not null then 1 else 0 end), 0)::int,
        count(*)::int
      into v_qualified, v_count
      from public.referrals r
     where r.referrer_id = p_user_id;

    select count(*)::int into v_redeemed
      from public.referral_redemptions rr
     where rr.user_id = p_user_id;

    v_earned := v_qualified / 4;

    referral_code     := v_code;
    qualified_total   := v_qualified;
    earned_credits    := v_earned;
    redeemed_total    := v_redeemed;
    available_credits := greatest(0, v_earned - v_redeemed);
    referee_count     := v_count;
    return next;
end;
$$;

grant execute on function public.admin_referral_overview(uuid) to authenticated;


-- ========== RPC: admin_list_user_referrals (enriched) ==========
-- Adds referee_email / referrer_email, a source marker (organic vs admin),
-- and a has_paid flag for the referee. Return type changes, so drop first.

drop function if exists public.admin_list_user_referrals(uuid);

create function public.admin_list_user_referrals(p_user_id uuid)
returns table (
    direction          text,
    referee_id         uuid,
    referee_username   text,
    referee_email      text,
    referrer_id        uuid,
    referrer_username  text,
    referrer_email     text,
    referrer_code_used text,
    source             text,
    has_paid           boolean,
    created_at         timestamptz,
    qualified_at       timestamptz
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
        ree_u.email::text,
        r.referrer_id,
        rer.username::text,
        rer_u.email::text,
        r.referrer_code_used,
        case when r.referrer_code_used = 'ADMIN' then 'admin' else 'organic' end::text,
        exists (
            select 1
              from public.tournament_payments tp
              join public.predictions pr on pr.id = tp.prediction_id
             where pr.user_id = r.referee_id and tp.is_free = false
        ),
        r.created_at,
        r.qualified_at
      from public.referrals r
      join public.profiles ree on ree.id = r.referee_id
      left join auth.users ree_u on ree_u.id = r.referee_id
      join public.profiles rer on rer.id = r.referrer_id
      left join auth.users rer_u on rer_u.id = r.referrer_id
     where r.referrer_id = p_user_id or r.referee_id = p_user_id
     order by r.created_at desc;
end;
$$;

grant execute on function public.admin_list_user_referrals(uuid) to authenticated;


-- ========== RPC: admin_list_referral_audit ==========

create function public.admin_list_referral_audit(p_user_id uuid)
returns table (
    id                uuid,
    actor_username    text,
    action            text,
    referrer_id       uuid,
    referrer_username text,
    referee_id        uuid,
    referee_username  text,
    referee_email     text,
    note              text,
    created_at        timestamptz
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
        a.id,
        actor.username::text,
        a.action,
        a.referrer_id,
        rer.username::text,
        a.referee_id,
        ree.username::text,
        a.referee_email,
        a.note,
        a.created_at
      from public.referral_admin_audit a
      left join public.profiles actor on actor.id = a.actor_id
      left join public.profiles rer on rer.id = a.referrer_id
      left join public.profiles ree on ree.id = a.referee_id
     where a.referrer_id = p_user_id or a.referee_id = p_user_id
     order by a.created_at desc;
end;
$$;

grant execute on function public.admin_list_referral_audit(uuid) to authenticated;
