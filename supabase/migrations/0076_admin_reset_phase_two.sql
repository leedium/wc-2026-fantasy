-- 0076_admin_reset_phase_two.sql
--
-- "Reset Phase 2" — revert a tournament to its locked Phase 1 state.
--
-- admin_set_phase_two's "close" path (knockout_unlocked = false) reverts the
-- phase to phase1_locked but deliberately PRESERVES knockout_lock_time, so the
-- Phase 2 lock time is left stale and per-fixture locks (knockout_match_locks,
-- 0072) linger and would silently re-apply on a future reopen. This RPC is the
-- clean-slate revert: it clears the Phase 2 config entirely and the per-fixture
-- locks, but PRESERVES users' knockout_predictions (re-opening Phase 2 restores
-- the picks untouched), so the action is fully reversible.
--
-- Super-admin gated (a tournament-wide phase revert is weighty); the lighter,
-- time-preserving "Close Phase 2" (admin_set_phase_two, is_admin) stays as-is.

create or replace function public.admin_reset_phase_two(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_super_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found' using errcode = 'P0001';
    end if;

    update public.tournaments
       set knockout_unlocked = false,
           knockout_lock_time = null
     where id = p_tournament_id;

    -- Per-fixture locks are a Phase-2 artifact; clear them so any future reopen
    -- starts clean. (They're inert in phase1_locked anyway.) knockout_predictions
    -- are intentionally left intact — this revert is reversible.
    delete from public.knockout_match_locks where tournament_id = p_tournament_id;
end;
$$;

revoke all on function public.admin_reset_phase_two(uuid) from public;
grant execute on function public.admin_reset_phase_two(uuid) to authenticated;
