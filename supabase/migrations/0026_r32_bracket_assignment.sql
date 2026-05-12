-- R32 bracket assignment.
--
-- In the old "bundle" model the user's bundle pick implicitly determined
-- which group's 3rd-place team filled each R32 slot — the resolver walked
-- bundle_predictions to find the team for a given source like '3-ABCDF'.
--
-- In the new ranked-top-8 model, the user has no opinion on the FIFA
-- bracket layout. They pick 8 teams in order; FIFA decides which goes
-- where. Admin records that decision here once FIFA publishes the bracket.
--
-- The 3rd-place R32 slots (per supabase/seed.sql) are:
--   M2:2  M5:2  M7:2  M8:2  M9:2  M10:2  M13:2  M15:2
-- where slot = 1 means team1 and slot = 2 means team2. We don't hard-code
-- those eight tuples here — we discover them by scanning
-- knockout_matches.team{1,2}_source for the '3-%' prefix. That keeps the
-- migration in lock-step with seed.sql if FIFA ever republishes.

-- ========== r32_bracket_assignments ==========

create table public.r32_bracket_assignments (
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    match_id text not null references public.knockout_matches(id),
    slot smallint not null check (slot in (1, 2)),
    team_id text not null references public.teams(id),
    primary key (tournament_id, match_id, slot),
    unique (tournament_id, team_id)
);

alter table public.r32_bracket_assignments enable row level security;

create policy "r32_bracket_assignments_select_all"
    on public.r32_bracket_assignments for select
    using (true);

create policy "r32_bracket_assignments_admin_write"
    on public.r32_bracket_assignments for all
    using (public.is_admin())
    with check (public.is_admin());

grant select on public.r32_bracket_assignments to anon, authenticated;
grant insert, update, delete on public.r32_bracket_assignments to authenticated;

-- ========== admin_set_r32_bracket ==========

create or replace function public.admin_set_r32_bracket(
    p_tournament_id uuid,
    p_match_id text,
    p_slot smallint,
    p_team_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_source text;
    v_is_advancer boolean;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_slot not in (1, 2) then
        raise exception 'invalid slot %', p_slot using errcode = 'P0001';
    end if;

    select case when p_slot = 1 then team1_source else team2_source end
      into v_source
      from public.knockout_matches
     where id = p_match_id;

    if v_source is null then
        raise exception 'unknown R32 match %', p_match_id using errcode = 'P0001';
    end if;
    if v_source not like '3-%' then
        raise exception 'R32 slot (%, %) is not a 3rd-place slot', p_match_id, p_slot
            using errcode = 'P0001';
    end if;

    select exists(
        select 1 from public.tournament_advancers
         where tournament_id = p_tournament_id and team_id = p_team_id
    ) into v_is_advancer;

    if not v_is_advancer then
        raise exception 'team % is not in the top-8 advancers for this tournament', p_team_id
            using errcode = 'P0001';
    end if;

    insert into public.r32_bracket_assignments (tournament_id, match_id, slot, team_id)
    values (p_tournament_id, p_match_id, p_slot, p_team_id)
    on conflict (tournament_id, match_id, slot)
    do update set team_id = excluded.team_id;
end;
$$;

grant execute on function public.admin_set_r32_bracket(uuid, text, smallint, text) to authenticated;

-- ========== admin_clear_r32_bracket ==========

create or replace function public.admin_clear_r32_bracket(
    p_tournament_id uuid,
    p_match_id text,
    p_slot smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    delete from public.r32_bracket_assignments
     where tournament_id = p_tournament_id
       and match_id = p_match_id
       and slot = p_slot;
end;
$$;

grant execute on function public.admin_clear_r32_bracket(uuid, text, smallint) to authenticated;

-- ========== admin_set_phase_two: stricter gate ==========
-- Replaces the 0022 version. Phase 2 may only open once:
--   * all 8 tournament_advancers ranks are filled, AND
--   * every R32 3rd-place slot has an r32_bracket_assignments row.

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
    v_advancer_count int;
    v_slot_count int;
    v_assignment_count int;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_unlocked then
        select count(*) into v_advancer_count
          from public.tournament_advancers
         where tournament_id = p_tournament_id;
        if v_advancer_count <> 8 then
            raise exception 'all 8 advancers must be set before opening phase 2'
                using errcode = 'P0001';
        end if;

        select count(*) into v_slot_count
          from public.knockout_matches m
          cross join lateral (values (1::smallint, m.team1_source), (2::smallint, m.team2_source)) as src(slot, source)
         where src.source like '3-%' and m.stage = 'round_of_32';

        select count(*) into v_assignment_count
          from public.r32_bracket_assignments
         where tournament_id = p_tournament_id;

        if v_assignment_count <> v_slot_count then
            raise exception 'all R32 3rd-place bracket slots must be assigned before opening phase 2 (% of % assigned)',
                v_assignment_count, v_slot_count
                using errcode = 'P0001';
        end if;
    end if;

    update public.tournaments
       set knockout_unlocked = p_unlocked,
           knockout_lock_time = case when p_unlocked then p_lock_time else knockout_lock_time end
     where id = p_tournament_id;
end;
$$;

grant execute on function public.admin_set_phase_two(uuid, boolean, timestamptz) to authenticated;
