-- WC2026 — Row-Level Security policies

-- Helper: is the current auth user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Helper: current active-tournament lock check for a given tournament_id
create or replace function public.is_before_lock(tid uuid)
returns boolean
language sql
stable
as $$
    select coalesce((select now() < lock_time from public.tournaments where id = tid), false);
$$;

-- ========== profiles ==========
alter table public.profiles enable row level security;

create policy "profiles_select_all"
    on public.profiles for select
    using (true);

create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Block users from flipping is_admin on their own row
create or replace function public.prevent_admin_self_elevation()
returns trigger
language plpgsql
as $$
begin
    if old.is_admin is distinct from new.is_admin and not public.is_admin() then
        raise exception 'cannot modify is_admin';
    end if;
    return new;
end;
$$;

create trigger profiles_block_admin_self_elevation
before update on public.profiles
for each row execute function public.prevent_admin_self_elevation();

-- ========== tournaments ==========
alter table public.tournaments enable row level security;

create policy "tournaments_select_all"
    on public.tournaments for select
    using (true);

create policy "tournaments_admin_write"
    on public.tournaments for all
    using (public.is_admin())
    with check (public.is_admin());

-- ========== groups / teams / knockout_matches (public reference data) ==========
alter table public.groups enable row level security;
alter table public.teams enable row level security;
alter table public.knockout_matches enable row level security;

create policy "groups_select_all" on public.groups for select using (true);
create policy "groups_admin_write" on public.groups for all using (public.is_admin()) with check (public.is_admin());

create policy "teams_select_all" on public.teams for select using (true);
create policy "teams_admin_write" on public.teams for all using (public.is_admin()) with check (public.is_admin());

create policy "knockout_matches_select_all" on public.knockout_matches for select using (true);
create policy "knockout_matches_admin_write" on public.knockout_matches for all using (public.is_admin()) with check (public.is_admin());

-- ========== predictions ==========
alter table public.predictions enable row level security;

create policy "predictions_select_own_or_admin"
    on public.predictions for select
    using (auth.uid() = user_id or public.is_admin());

create policy "predictions_insert_own_before_lock"
    on public.predictions for insert
    with check (auth.uid() = user_id and public.is_before_lock(tournament_id));

create policy "predictions_update_own_before_lock"
    on public.predictions for update
    using (auth.uid() = user_id and public.is_before_lock(tournament_id))
    with check (auth.uid() = user_id and public.is_before_lock(tournament_id));

create policy "predictions_delete_admin"
    on public.predictions for delete
    using (public.is_admin());

-- ========== group_predictions / knockout_predictions (gated via parent) ==========
alter table public.group_predictions enable row level security;
alter table public.knockout_predictions enable row level security;

create policy "group_predictions_select_own_or_admin"
    on public.group_predictions for select
    using (
        public.is_admin() or exists (
            select 1 from public.predictions p
            where p.id = group_predictions.prediction_id and p.user_id = auth.uid()
        )
    );

create policy "group_predictions_write_own_before_lock"
    on public.group_predictions for all
    using (
        exists (
            select 1 from public.predictions p
            where p.id = group_predictions.prediction_id
              and p.user_id = auth.uid()
              and public.is_before_lock(p.tournament_id)
        )
    )
    with check (
        exists (
            select 1 from public.predictions p
            where p.id = group_predictions.prediction_id
              and p.user_id = auth.uid()
              and public.is_before_lock(p.tournament_id)
        )
    );

create policy "knockout_predictions_select_own_or_admin"
    on public.knockout_predictions for select
    using (
        public.is_admin() or exists (
            select 1 from public.predictions p
            where p.id = knockout_predictions.prediction_id and p.user_id = auth.uid()
        )
    );

create policy "knockout_predictions_write_own_before_lock"
    on public.knockout_predictions for all
    using (
        exists (
            select 1 from public.predictions p
            where p.id = knockout_predictions.prediction_id
              and p.user_id = auth.uid()
              and public.is_before_lock(p.tournament_id)
        )
    )
    with check (
        exists (
            select 1 from public.predictions p
            where p.id = knockout_predictions.prediction_id
              and p.user_id = auth.uid()
              and public.is_before_lock(p.tournament_id)
        )
    );

-- ========== group_standings / knockout_results (admin-only writes, public reads) ==========
alter table public.group_standings enable row level security;
alter table public.knockout_results enable row level security;

create policy "group_standings_select_all" on public.group_standings for select using (true);
create policy "group_standings_admin_write" on public.group_standings for all using (public.is_admin()) with check (public.is_admin());

create policy "knockout_results_select_all" on public.knockout_results for select using (true);
create policy "knockout_results_admin_write" on public.knockout_results for all using (public.is_admin()) with check (public.is_admin());
