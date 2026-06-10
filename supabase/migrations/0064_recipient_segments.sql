-- Migration 0064: recipient segments for the admin broadcast-email tool
--
-- Extends 0063 (which only had all / paid-only) with two more mailing segments
-- so admins can nudge non-participants and unpaid participants:
--   'all'            — every registered user with an email
--   'paid'           — >=1 prediction with a payment in the active tournament
--   'unpaid'         — >=1 prediction in the active tournament, but none paid
--   'no_prediction'  — no predictions in the active tournament
-- Together these partition the user base (no_prediction + unpaid + paid = all).
--
-- Added as a NEW overload `(p_segment text)` rather than replacing the existing
-- `(p_paid_only boolean)` so the deployed Worker keeps working until the new
-- code ships (zero-downtime). The boolean overload is now superseded and can be
-- dropped in a later cleanup migration.

create or replace function public.admin_list_recipient_emails(p_segment text)
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tournament_id uuid;
    v_segment text;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    v_segment := lower(coalesce(nullif(trim(p_segment), ''), 'all'));

    select t.id into v_tournament_id from public.tournaments t where t.is_active limit 1;

    return query
    select distinct u.email::text as email
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email is not null
      and btrim(u.email::text) <> ''
      and (
        case v_segment
          when 'paid' then exists (
            select 1
            from public.predictions pr
            join public.tournament_payments tp on tp.prediction_id = pr.id
            where pr.user_id = p.id and pr.tournament_id = v_tournament_id
          )
          when 'unpaid' then exists (
            select 1 from public.predictions pr
            where pr.user_id = p.id and pr.tournament_id = v_tournament_id
          ) and not exists (
            select 1
            from public.predictions pr
            join public.tournament_payments tp on tp.prediction_id = pr.id
            where pr.user_id = p.id and pr.tournament_id = v_tournament_id
          )
          when 'no_prediction' then not exists (
            select 1 from public.predictions pr
            where pr.user_id = p.id and pr.tournament_id = v_tournament_id
          )
          else true -- 'all'
        end
      )
    order by email;
end;
$$;

grant execute on function public.admin_list_recipient_emails(text) to authenticated;
