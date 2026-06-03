-- WC2026 — Self-service account deletion
--
-- Lets a user delete their OWN account from the account settings page.
-- The admin-only admin_delete_user (0009) explicitly blocks self-deletion
-- and requires is_admin(), so it cannot be reused here — this RPC is the
-- caller-scoped counterpart.
--
-- Email changes are handled entirely at the auth layer
-- (supabase.auth.updateUser({ email }) with double-confirm) — no SQL needed.

-- ========== RPC: delete_own_account ==========
-- Hard-deletes the caller's account. Cascades wipe profiles, predictions,
-- group_predictions, knockout_predictions, advancers, tournament_payments,
-- referrals, referral_codes, loyalty_redemptions via the FKs declared in
-- 0001 / 0008 / 0035 / 0038.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_is_admin boolean;
begin
    if v_uid is null then
        raise exception 'not authenticated' using errcode = 'P0001';
    end if;

    select is_admin into v_is_admin from public.profiles where id = v_uid;

    -- Admins must be removed through proper channels; this also protects the
    -- tournament_payments.marked_by FK (no ON DELETE clause) from breaking.
    if coalesce(v_is_admin, false) then
        raise exception 'cannot delete admin account' using errcode = 'P0001';
    end if;

    -- Block while any committed entry exists (cash or free pick) so paid
    -- leaderboard / payment history is preserved. Users with entries must
    -- contact the organizer to be removed.
    if exists (select 1 from public.tournament_payments where user_id = v_uid) then
        raise exception 'account has paid entries' using errcode = 'P0001';
    end if;

    delete from auth.users where id = v_uid;  -- cascades wipe everything else
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
