-- Admin "clear" paths for group standings + knockout results.
--
-- Mirrors admin_set_group_standing / admin_set_knockout_result (0005) but
-- DELETEs the row instead of upserting. Lets admins revert a saved result
-- back to the unsubmitted state directly from the form's Select (the empty
-- "(none)" entry fires this RPC).

create or replace function public.admin_clear_group_standing(
    p_tournament_id uuid,
    p_group_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    delete from public.group_standings
     where tournament_id = p_tournament_id
       and group_id = p_group_id;
end;
$$;

revoke all on function public.admin_clear_group_standing(uuid, text) from public;
grant execute on function public.admin_clear_group_standing(uuid, text) to authenticated;

create or replace function public.admin_clear_knockout_result(
    p_tournament_id uuid,
    p_match_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    delete from public.knockout_results
     where tournament_id = p_tournament_id
       and match_id = p_match_id;
end;
$$;

revoke all on function public.admin_clear_knockout_result(uuid, text) from public;
grant execute on function public.admin_clear_knockout_result(uuid, text) to authenticated;
