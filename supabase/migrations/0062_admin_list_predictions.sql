-- Admin-facing, tournament-wide list of every prediction (drafts + submitted)
-- for the active tournament, ordered by most recently updated. Read-only.
-- Mirrors admin_list_users (0061): SECURITY DEFINER + is_admin() gate +
-- paginated with an embedded total_count. saved_date is sourced from
-- submitted_at (null for unsubmitted drafts).

create or replace function public.admin_list_predictions(
    p_search text,
    p_page int,
    p_page_size int
)
returns table (
    id uuid,
    user_id uuid,
    username text,
    email text,
    prediction_name text,
    submitted_at timestamptz,
    updated_at timestamptz,
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
            pr.id,
            pr.user_id,
            p.username::text as username,
            u.email::text as email,
            pr.prediction_name::text as prediction_name,
            pr.submitted_at,
            pr.updated_at
        from public.predictions pr
        left join public.profiles p on p.id = pr.user_id
        left join auth.users u on u.id = pr.user_id
        where pr.tournament_id = v_tournament_id
          and (v_search is null
               or p.username::text ilike '%' || v_search || '%'
               or u.email::text ilike '%' || v_search || '%'
               or pr.prediction_name::text ilike '%' || v_search || '%')
    ),
    counted as (select count(*) as total from filtered)
    select f.*, c.total
    from filtered f cross join counted c
    order by f.updated_at desc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_predictions(text, int, int) to authenticated;
