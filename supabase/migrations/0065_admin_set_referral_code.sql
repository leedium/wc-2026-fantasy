-- ========== Admin: set a custom (vanity) referral code ==========
-- Lets a super-admin overwrite a user's auto-generated referral code with a
-- recognizable vanity code (e.g. an influencer's handle). The backend already
-- resolves any code format (plain citext lookup in handle_new_user +
-- resolve_referrer_username); the only missing piece was a gated write path,
-- since RLS denies all client writes to referral_codes.
--
-- Gated to is_super_admin() (stricter than the is_admin() peers in
-- 0059_admin_referrals.sql) because vanity codes are a sensitive,
-- rarely-used override. Format mirrors the relaxed frontend
-- REFERRAL_CODE_REGEX: 4–32 chars, uppercase A–Z + digits.

-- Allow the new audit action.
alter table public.referral_admin_audit
    drop constraint referral_admin_audit_action_check,
    add constraint referral_admin_audit_action_check
        check (action in ('add', 'remove', 'set_code'));


-- ========== RPC: admin_set_referral_code ==========

create function public.admin_set_referral_code(
    p_user_id uuid,
    p_code text,
    p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_note text := nullif(trim(p_note), '');
    v_code text := upper(nullif(trim(p_code), ''));
begin
    if not public.is_super_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if v_code is null then
        raise exception 'code is required' using errcode = 'P0001';
    end if;
    if v_code !~ '^[A-Z0-9]{4,32}$' then
        raise exception 'invalid code format' using errcode = 'P0001';
    end if;
    if v_note is null then
        raise exception 'note is required' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.profiles where id = p_user_id) then
        raise exception 'user not found' using errcode = 'P0001';
    end if;
    -- citext column, so this comparison is case-insensitive (matches the
    -- unique index behaviour) and guards against collisions with other users.
    if exists (
        select 1 from public.referral_codes
         where code = v_code and user_id <> p_user_id
    ) then
        raise exception 'code already in use' using errcode = 'P0001';
    end if;

    update public.referral_codes set code = v_code where user_id = p_user_id;
    if not found then
        -- Every profile is backfilled (0035) + trigger-created, so this should
        -- be unreachable; surface it rather than silently no-op.
        raise exception 'referral code row missing' using errcode = 'P0001';
    end if;

    insert into public.referral_admin_audit
        (actor_id, action, referee_id, note)
    values
        (auth.uid(), 'set_code', p_user_id, 'set code ' || v_code || ' — ' || v_note);
end;
$$;

grant execute on function public.admin_set_referral_code(uuid, text, text) to authenticated;
