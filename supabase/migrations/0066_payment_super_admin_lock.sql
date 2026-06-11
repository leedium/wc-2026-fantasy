-- Restrict payment writes to super admins after the tournament lock.
--
-- Supersedes the carve-out documented in 0018_super_admin_lock_bypass.sql
-- ("Regular admins can still mark payments paid/unpaid past lock"). That is
-- no longer the policy: once lock_time has passed, only super admins may
-- change a prediction's payment state.
--
-- Rationale: the leaderboard counts a payment only when paid_at <= lock_time
-- (get_leaderboard). Combined with the free-form "Paid at" admin field, a
-- regular admin could mark — or backdate — a late payment and surface a
-- post-lock entry on the leaderboard. This gate closes that hole at the
-- trust boundary. The body is identical to 0015 except for the added
-- is_super_admin / is_before_lock gate.

create or replace function public.admin_set_prediction_payment(
    p_prediction_id uuid,
    p_paid boolean,
    p_paid_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_tournament_id uuid;
    v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_prediction_id is null then
        raise exception 'prediction_id is required' using errcode = 'P0001';
    end if;

    select user_id, tournament_id
      into v_user_id, v_tournament_id
      from public.predictions
     where id = p_prediction_id;

    if not found then
        raise exception 'prediction not found' using errcode = 'P0001';
    end if;

    -- Past lock, only super admins may change payment state. This prevents
    -- late (or backdated) payments from surfacing on the leaderboard.
    if not public.is_super_admin() and not public.is_before_lock(v_tournament_id) then
        raise exception 'payments are locked' using errcode = 'P0001';
    end if;

    if p_paid then
        insert into public.tournament_payments (user_id, tournament_id, prediction_id, paid_at, marked_by)
        values (v_user_id, v_tournament_id, p_prediction_id, v_paid_at, auth.uid())
        on conflict (prediction_id) do update
            set paid_at = excluded.paid_at,
                marked_by = excluded.marked_by;
    else
        delete from public.tournament_payments where prediction_id = p_prediction_id;
    end if;
end;
$$;

grant execute on function public.admin_set_prediction_payment(uuid, boolean, timestamptz) to authenticated;
