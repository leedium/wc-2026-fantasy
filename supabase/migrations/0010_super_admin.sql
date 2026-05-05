-- WC2026 — Super Admin
--
-- One designated super admin. Cannot be demoted or deleted by any other
-- admin. The is_super_admin flag itself can only be flipped via direct
-- SQL with session_replication_role = 'replica'; no RPC or app code path
-- is provided. Designated user: leedium@me.com.

-- ========== Column ==========
alter table public.profiles
    add column if not exists is_super_admin boolean not null default false;

-- ========== Initial designation (before the trigger that would block it) ==========
-- No-op if the user doesn't exist yet (e.g., fresh local DB).
update public.profiles
    set is_super_admin = true
    where id = (select id from auth.users where email = 'leedium@me.com');

-- ========== Trigger: block is_super_admin flips from app context ==========
create or replace function public.prevent_super_admin_change()
returns trigger
language plpgsql
as $$
begin
    if old.is_super_admin is distinct from new.is_super_admin then
        raise exception 'cannot modify is_super_admin from app context'
            using errcode = 'P0001';
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_block_super_admin_change on public.profiles;
create trigger profiles_block_super_admin_change
    before update on public.profiles
    for each row execute function public.prevent_super_admin_change();

-- ========== Replace admin_set_user_admin: refuse demoting a super admin ==========
create or replace function public.admin_set_user_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_other_admin_count int;
    v_target_is_super_admin boolean;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_is_admin = false then
        select is_super_admin into v_target_is_super_admin
        from public.profiles where id = p_user_id;
        if coalesce(v_target_is_super_admin, false) then
            raise exception 'cannot demote super admin' using errcode = 'P0001';
        end if;

        select count(*) into v_other_admin_count
        from public.profiles
        where is_admin = true and id <> p_user_id;
        if v_other_admin_count = 0 then
            raise exception 'cannot demote last admin' using errcode = 'P0001';
        end if;
    end if;

    update public.profiles set is_admin = p_is_admin where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;

-- ========== Replace admin_delete_user: refuse deleting a super admin ==========
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_target_is_admin boolean;
    v_target_is_super_admin boolean;
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

    select is_admin, is_super_admin
        into v_target_is_admin, v_target_is_super_admin
    from public.profiles where id = p_user_id;

    if v_target_is_admin is null then
        raise exception 'user not found' using errcode = 'P0001';
    end if;

    if coalesce(v_target_is_super_admin, false) then
        raise exception 'cannot delete super admin' using errcode = 'P0001';
    end if;

    if v_target_is_admin then
        raise exception 'cannot delete admin' using errcode = 'P0001';
    end if;

    delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ========== Replace admin_list_users: surface is_super_admin ==========
-- Return signature gains is_super_admin; CREATE OR REPLACE can't change
-- OUT params, so drop first.
drop function if exists public.admin_list_users(text, int, int);

create or replace function public.admin_list_users(
    p_search text,
    p_page int,
    p_page_size int
)
returns table (
    id uuid,
    username text,
    is_admin boolean,
    is_super_admin boolean,
    has_prediction boolean,
    submitted_at timestamptz,
    is_paid boolean,
    paid_at timestamptz,
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
            p.is_admin,
            p.is_super_admin,
            pr.id is not null as has_prediction,
            pr.submitted_at,
            tp.id is not null as is_paid,
            tp.paid_at
        from public.profiles p
        left join public.predictions pr
            on pr.user_id = p.id and pr.tournament_id = v_tournament_id
        left join public.tournament_payments tp
            on tp.user_id = p.id and tp.tournament_id = v_tournament_id
        where v_search is null or p.username::text ilike '%' || v_search || '%'
    ),
    counted as (
        select count(*) as total from filtered
    )
    select
        f.id,
        f.username,
        f.is_admin,
        f.is_super_admin,
        f.has_prediction,
        f.submitted_at,
        f.is_paid,
        f.paid_at,
        c.total
    from filtered f
    cross join counted c
    order by f.username asc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_users(text, int, int) to authenticated;
