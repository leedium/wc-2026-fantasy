-- WC2026 — Support tickets
--
-- A minimal inbound support channel. Logged-in users submit a ticket with
-- a subject (fixed enum), a title, and a description (≤ 2000 chars).
-- Admins view all tickets via `admin_list_support_tickets` and delete the
-- row when the issue is resolved (reply happens out-of-band via the
-- admin's own email client for v1; an in-app SMTP reply can be added
-- later by adding nullable `responded_at` / `admin_notes` columns).
--
-- Security:
--   * Tickets are owner-readable + admin-readable. Owners CAN insert but
--     CANNOT update or delete; admins can delete.
--   * `admin_list_support_tickets` is SECURITY DEFINER + is_admin()-gated
--     so it can join `auth.users` for the email field without exposing
--     that table to client RLS.


create table public.support_tickets (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    subject     text not null,
    title       text not null,
    description text not null,
    created_at  timestamptz not null default now(),
    constraint support_tickets_subject_check
        check (subject in ('account','settings','bug','prediction','payment')),
    constraint support_tickets_title_length
        check (char_length(title) between 1 and 120),
    constraint support_tickets_description_length
        check (char_length(description) between 1 and 2000)
);

-- Powers the user's own ticket list (`/api/support` GET).
create index support_tickets_user_created_idx
    on public.support_tickets (user_id, created_at desc);

-- Powers admin pagination ordered by newest first.
create index support_tickets_created_idx
    on public.support_tickets (created_at desc);

alter table public.support_tickets enable row level security;

-- Owners and admins can read.
create policy "support_tickets_select_own_or_admin"
    on public.support_tickets for select
    using (auth.uid() = user_id or public.is_admin());

-- Owners can insert their own ticket. No UPDATE policy — tickets are
-- immutable from creation through deletion.
create policy "support_tickets_insert_own"
    on public.support_tickets for insert
    with check (auth.uid() = user_id);

-- Admins (and only admins) can delete.
create policy "support_tickets_delete_admin"
    on public.support_tickets for delete
    using (public.is_admin());

grant select, insert, delete on public.support_tickets to authenticated;


-- ========== RPC: admin_list_support_tickets ==========
-- Mirrors admin_list_users: SECURITY DEFINER, is_admin()-gated, joins
-- auth.users for email. Returns one page of tickets ordered by newest
-- first plus a `total_count` window for client-side pagination.
create or replace function public.admin_list_support_tickets(
    p_page int default 1,
    p_page_size int default 25
) returns table (
    id          uuid,
    user_id     uuid,
    username    text,
    email       text,
    subject     text,
    title       text,
    description text,
    created_at  timestamptz,
    total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit int;
    v_offset int;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    v_limit := greatest(1, least(coalesce(p_page_size, 25), 100));
    v_offset := greatest(0, (coalesce(p_page, 1) - 1) * v_limit);

    return query
    select
        t.id,
        t.user_id,
        p.username::text,
        u.email::text,
        t.subject,
        t.title,
        t.description,
        t.created_at,
        count(*) over () as total_count
    from public.support_tickets t
    join public.profiles p on p.id = t.user_id
    left join auth.users u on u.id = t.user_id
    order by t.created_at desc
    limit v_limit offset v_offset;
end;
$$;

grant execute on function public.admin_list_support_tickets(int, int) to authenticated;
