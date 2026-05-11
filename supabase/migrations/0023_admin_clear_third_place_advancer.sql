-- Admin "clear" path for R32 best-third advancer slots.
--
-- Mirrors admin_set_third_place_advancer (0022) but deletes the row instead of
-- upserting, so an admin can revert a slot back to the unsubmitted state.

create or replace function public.admin_clear_third_place_advancer(
    p_tournament_id uuid,
    p_slot_index int
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
    delete from public.tournament_third_place_advancers
     where tournament_id = p_tournament_id
       and slot_index = p_slot_index;
end;
$$;

revoke all on function public.admin_clear_third_place_advancer(uuid, int) from public;
grant execute on function public.admin_clear_third_place_advancer(uuid, int) to authenticated;
