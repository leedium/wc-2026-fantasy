-- Migration 0037: include email in admin_list_users
--
-- The admin user list and edit dialog need to show the user's email
-- (read-only). `auth.users.email` isn't reachable from a normal client,
-- but admin_list_users is SECURITY DEFINER and already gated on is_admin(),
-- so it can safely return the column.

drop function if exists public.admin_list_users(text, int, int);

create or replace function public.admin_list_users(
    p_search text,
    p_page int,
    p_page_size int
)
returns table (
    id uuid,
    username text,
    email text,
    is_admin boolean,
    is_super_admin boolean,
    prediction_count int,
    paid_prediction_count int,
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
            u.email::text as email,
            p.is_admin,
            p.is_super_admin,
            coalesce(counts.prediction_count, 0)::int as prediction_count,
            coalesce(counts.paid_prediction_count, 0)::int as paid_prediction_count
        from public.profiles p
        left join auth.users u on u.id = p.id
        left join lateral (
            select
                count(*) as prediction_count,
                count(*) filter (
                    where exists (
                        select 1 from public.tournament_payments tp
                        where tp.prediction_id = pr.id
                    )
                ) as paid_prediction_count
            from public.predictions pr
            where pr.user_id = p.id and pr.tournament_id = v_tournament_id
        ) counts on true
        where v_search is null
           or p.username::text ilike '%' || v_search || '%'
           or u.email::text ilike '%' || v_search || '%'
    ),
    counted as (
        select count(*) as total from filtered
    )
    select
        f.id,
        f.username,
        f.email,
        f.is_admin,
        f.is_super_admin,
        f.prediction_count,
        f.paid_prediction_count,
        c.total
    from filtered f
    cross join counted c
    order by f.username asc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_users(text, int, int) to authenticated;
