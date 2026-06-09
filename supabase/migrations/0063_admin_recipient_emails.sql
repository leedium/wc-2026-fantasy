-- Migration 0063: recipient enumeration for the admin broadcast-email tool
--
-- The admin "Messages" page composes a subject + HTML body and sends it to
-- either every registered user or only users who have a paid entry in the
-- active tournament. This RPC returns the de-duplicated recipient email list
-- (or its count) for that send. SECURITY DEFINER so it can read auth.users,
-- gated on is_admin() exactly like admin_list_users (0061).
--
-- "Paid" mirrors the dashboard's usersWithPaidPrediction definition: a user
-- owning >=1 prediction with ANY tournament_payments row (cash or free) in the
-- active tournament. Emails with a null/blank address (shouldn't happen for
-- email-auth accounts, but auth.users.email is nullable) are excluded so the
-- caller never tries to send to an empty address.

create or replace function public.admin_list_recipient_emails(p_paid_only boolean)
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tournament_id uuid;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    select t.id into v_tournament_id from public.tournaments t where t.is_active limit 1;

    return query
    select distinct u.email::text as email
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email is not null
      and btrim(u.email::text) <> ''
      and (
        not coalesce(p_paid_only, false)
        or exists (
            select 1
            from public.predictions pr
            join public.tournament_payments tp on tp.prediction_id = pr.id
            where pr.user_id = p.id
              and pr.tournament_id = v_tournament_id
        )
      )
    order by email;
end;
$$;

grant execute on function public.admin_list_recipient_emails(boolean) to authenticated;
