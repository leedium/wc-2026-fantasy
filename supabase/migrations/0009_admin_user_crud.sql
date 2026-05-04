-- WC2026 — Admin CRUD on non-admin user accounts
--
-- Adds two RPCs that let an admin remove or rename other accounts.
-- Account creation and password reset are handled by the route layer
-- via the Supabase Admin API (auth.admin.createUser / generateLink) —
-- no SQL needed for those because the existing handle_new_user trigger
-- (0003) populates profiles from user_metadata on insert.

-- ========== RPC: admin_delete_user ==========
-- Hard-deletes an account. Cascades wipe profiles, predictions,
-- group_predictions, knockout_predictions, tournament_payments via
-- the FKs declared in 0001 / 0008.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_target_is_admin boolean;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_user_id is null then
        raise exception 'user_id is required' using errcode = 'P0001';
    end if;

    if p_user_id = auth.uid() then
        raise exception 'cannot delete self' using errcode = 'P0001';
    end if;

    select is_admin into v_target_is_admin
    from public.profiles
    where id = p_user_id;

    if v_target_is_admin is null then
        raise exception 'user not found' using errcode = 'P0001';
    end if;

    if v_target_is_admin then
        raise exception 'cannot delete admin' using errcode = 'P0001';
    end if;

    delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ========== RPC: admin_update_profile ==========
-- Edit username and/or display_name on another account. The
-- prevent_admin_self_elevation trigger (0002) only fires when is_admin
-- changes, so non-admin profile fields update cleanly. SECURITY DEFINER
-- bypasses the profiles_update_own policy that otherwise restricts
-- updates to auth.uid() = id.
create or replace function public.admin_update_profile(
    p_user_id uuid,
    p_username text,
    p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username citext;
    v_exists boolean;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_user_id is null then
        raise exception 'user_id is required' using errcode = 'P0001';
    end if;

    select true into v_exists from public.profiles where id = p_user_id;
    if not coalesce(v_exists, false) then
        raise exception 'user not found' using errcode = 'P0001';
    end if;

    -- Username update is optional; null/empty = leave alone.
    v_username := nullif(trim(coalesce(p_username, '')), '')::citext;

    if v_username is not null then
        if length(v_username::text) < 3 or length(v_username::text) > 24
           or v_username::text !~ '^[A-Za-z0-9_]+$' then
            raise exception 'username invalid format' using errcode = 'P0001';
        end if;

        begin
            update public.profiles
                set username = v_username
                where id = p_user_id;
        exception
            when unique_violation then
                raise exception 'username taken' using errcode = 'P0001';
        end;
    end if;

    -- display_name: pass null to clear, empty string treated as null,
    -- otherwise set to the trimmed value.
    update public.profiles
        set display_name = nullif(trim(coalesce(p_display_name, '')), '')
        where id = p_user_id;
end;
$$;

grant execute on function public.admin_update_profile(uuid, text, text) to authenticated;
