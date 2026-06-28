-- 0073_phase2_open_without_full_r32_assignments.sql
--
-- Relax the Phase 2 open guard for the progressive per-fixture model (0072).
--
-- admin_set_phase_two (latest body in 0052) refused to open Phase 2 until BOTH
-- all 12 group standings AND all 8 R32 3rd-place bracket slots were assigned.
-- That second requirement blocks the exact situation per-fixture locking exists
-- for: the group stage finishes only hours before the first knockout kicks off,
-- but the best-8 third-place advancers (and therefore the 8 "3-XXXX" R32 slot
-- assignments) aren't finalised until later. We need Phase 2 open early so users
-- can enter already-decided fixtures (e.g. M73 = 2A vs 2B, which depends on no
-- 3rd-place slot at all).
--
-- Fix: keep the 12-group-standings guard (groups are complete before any
-- knockout kickoff, and they feed every 1st/2nd-seeded R32 match), but DROP the
-- all-8-bracket-slots guard. Unassigned "3-XXXX" slots simply resolve to TBD and
-- stay unpickable until the admin assigns them; everything already resolved is
-- enterable immediately. Otherwise a verbatim re-emit of the 0052 body.

create or replace function public.admin_set_phase_two(
    p_tournament_id uuid,
    p_unlocked boolean,
    p_lock_time timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_standings_count int;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_unlocked then
        select count(*) into v_standings_count
          from public.group_standings
         where tournament_id = p_tournament_id;
        if v_standings_count <> 12 then
            raise exception 'all 12 group standings must be entered before opening phase 2 (% of 12)',
                v_standings_count
                using errcode = 'P0001';
        end if;
        -- NOTE: the former "all R32 3rd-place bracket slots must be assigned"
        -- guard is intentionally removed — Phase 2 may open with partial 3rd-place
        -- assignments; unassigned slots render TBD until the admin fills them.
    end if;

    update public.tournaments
       set knockout_unlocked = p_unlocked,
           knockout_lock_time = case when p_unlocked then p_lock_time else knockout_lock_time end
     where id = p_tournament_id;
end;
$$;

grant execute on function public.admin_set_phase_two(uuid, boolean, timestamptz) to authenticated;
