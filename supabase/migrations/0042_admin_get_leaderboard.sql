-- 0042_admin_get_leaderboard.sql
--
-- Admin-only variant of get_leaderboard that also returns each entry's
-- email (from auth.users). Mirrors the admin_list_users pattern from
-- 0037_admin_list_users_email.sql: SECURITY DEFINER + an is_admin()
-- guard at the top, granted to `authenticated` only.
--
-- Implementation is a thin wrapper over public.get_leaderboard so that
-- the scoring SQL stays in one place — we just join back to predictions
-- and auth.users to attach the email column.

create or replace function public.admin_get_leaderboard(
    p_tournament_id uuid,
    p_page int default 1,
    p_page_size int default 25
)
returns table (
    rank int,
    prediction_id uuid,
    prediction_name text,
    username text,
    email text,
    points numeric,
    group_points int,
    advancer_points numeric,
    knockout_points int,
    champion_pick_points int,
    total_goals int,
    total_count bigint
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
        lb.rank,
        lb.prediction_id,
        lb.prediction_name,
        lb.username,
        u.email::text as email,
        lb.points,
        lb.group_points,
        lb.advancer_points,
        lb.knockout_points,
        lb.champion_pick_points,
        lb.total_goals,
        lb.total_count
    from public.get_leaderboard(p_tournament_id, p_page, p_page_size) lb
    join public.predictions p on p.id = lb.prediction_id
    left join auth.users u on u.id = p.user_id
    order by lb.rank;
end;
$$;

grant execute on function public.admin_get_leaderboard(uuid, int, int) to authenticated;
