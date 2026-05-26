-- Super admin "Reset Tournament" action.
--
-- Wipes all user-generated data + admin-entered actuals for the given
-- tournament and returns it to a clean "upcoming" state. Intended for
-- pre-launch dress rehearsals or mid-cycle do-overs. Gated on
-- is_super_admin() — a regular admin cannot run it.
--
-- Preserves: auth.users, profiles, referral_codes, referrals (lifetime
-- social graph), all reference data (groups, teams, knockout_matches).
--
-- All per-tournament FKs already declare `on delete cascade`, so deleting
-- predictions + the four admin tables (group_standings, knockout_results,
-- tournament_advancers, r32_bracket_assignments) is sufficient. The
-- AFTER DELETE trigger referrals_sync_qualification on tournament_payments
-- clears referrals.qualified_at for any referee whose only non-free
-- payments lived in this tournament; cross-tournament credits stay sticky
-- via the greatest(0, ...) clamp in get_referral_status.
--
-- lock_time is NOT NULL on tournaments, so we push it 30 days out (matches
-- the seed default) — the admin re-enters the real date afterward.

create or replace function public.admin_reset_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_super_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_tournament_id is null then
        raise exception 'tournament_id is required' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found' using errcode = 'P0001';
    end if;

    delete from public.predictions where tournament_id = p_tournament_id;
    delete from public.group_standings where tournament_id = p_tournament_id;
    delete from public.knockout_results where tournament_id = p_tournament_id;
    delete from public.tournament_advancers where tournament_id = p_tournament_id;
    delete from public.r32_bracket_assignments where tournament_id = p_tournament_id;

    update public.tournaments
       set status = 'upcoming',
           lock_time = now() + interval '30 days',
           knockout_unlocked = false,
           knockout_lock_time = null,
           champion_total_goals = null
     where id = p_tournament_id;
end;
$$;

revoke all on function public.admin_reset_tournament(uuid) from public;
grant execute on function public.admin_reset_tournament(uuid) to authenticated;
