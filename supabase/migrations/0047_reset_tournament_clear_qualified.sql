-- Extend admin_reset_tournament (0046) to also clear orphaned
-- referrals.qualified_at flags.
--
-- Background: the referrals_sync_qualification trigger (0039) is supposed
-- to clear referrals.qualified_at AFTER DELETE on tournament_payments when
-- the referee has no remaining non-free payments. In practice, cascade-
-- delete from `delete from predictions where tournament_id = ?` can leave
-- some referees still flagged as qualified — either because the trigger's
-- intra-statement count snapshot doesn't always reflect concurrent cascade
-- deletes, or due to stale rows from earlier model versions.
--
-- Effect on the admin UI: `admin_list_users.total_rewards` (composition:
-- `floor(qualified_referrals / 4) + floor(active_tournament_cash_paid / 5)`)
-- stays > 0 after a reset for referrers with >= 4 stale qualified referees.
--
-- Fix: after deleting all per-tournament payments (cascaded from
-- predictions), explicitly clear qualified_at for any referee with no
-- remaining non-free tournament_payments. Safe under multi-tournament:
-- referees who paid in another tournament keep their qualification.
-- Already-redeemed credits stay sticky via the greatest(0, ...) clamp
-- in get_referral_status (per 0039).

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

    update public.referrals r
       set qualified_at = null
     where r.qualified_at is not null
       and not exists (
           select 1
             from public.tournament_payments tp
            where tp.user_id = r.referee_id
              and tp.is_free = false
       );

    update public.tournaments
       set status = 'upcoming',
           lock_time = now() + interval '30 days',
           knockout_unlocked = false,
           knockout_lock_time = null,
           champion_total_goals = null
     where id = p_tournament_id;
end;
$$;
