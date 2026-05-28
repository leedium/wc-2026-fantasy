-- 0052_decouple_r32_bracket.sql
--
-- Decouple Phase 2 R32 seeding from Phase 1 third-place picks / advancer
-- ranking. Going forward, each 3rd-place R32 slot accepts only the actual
-- third-place finisher from one of the groups encoded in its source string
-- (e.g. M74's "3-ABCDF" slot accepts only the third placer of group A, B,
-- C, D, or F per public.group_standings).
--
-- The unique (tournament_id, team_id) constraint on r32_bracket_assignments
-- continues to block the same team being placed in two slots.
--
-- Also relaxes admin_set_phase_two: no longer requires tournament_advancers
-- to be filled. Phase 2 can open as soon as group_standings is complete and
-- all 3rd-place R32 slots are assigned. tournament_advancers still drives
-- Phase 1 advancer scoring whenever it is filled — but it is no longer a
-- gate for opening Phase 2.

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
    v_letters text;
    v_groups text[];
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

    -- Source format is `3-XXXXX` where XXXXX is 4-6 single-letter group ids.
    v_letters := substring(v_source from 3);
    if v_letters !~ '^[A-L]+$' then
        raise exception 'malformed 3rd-place source %', v_source using errcode = 'P0001';
    end if;
    v_groups := regexp_split_to_array(v_letters, '');

    if not exists (
        select 1
        from public.group_standings gs
        where gs.tournament_id = p_tournament_id
          and gs.group_id = any(v_groups)
          and gs.third_team_id = p_team_id
    ) then
        raise exception 'team % is not a 3rd-place finisher in any of the groups %',
            p_team_id, v_groups
            using errcode = 'P0001';
    end if;

    insert into public.r32_bracket_assignments (tournament_id, match_id, slot, team_id)
    values (p_tournament_id, p_match_id, p_slot, p_team_id)
    on conflict (tournament_id, match_id, slot)
    do update set team_id = excluded.team_id;
end;
$$;

grant execute on function public.admin_set_r32_bracket(uuid, text, smallint, text) to authenticated;

-- ========== admin_set_phase_two ==========
-- Replaces 0026's gate. Phase 2 may open once:
--   * all 12 groups have a group_standings row, AND
--   * every R32 3rd-place slot has an r32_bracket_assignments row.
-- tournament_advancers is no longer a precondition.

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
    v_standings_count int;
    v_slot_count int;
    v_assignment_count int;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;

    if p_unlocked then
        select count(*) into v_standings_count
          from public.group_standings
         where tournament_id = p_tournament_id;
        if v_standings_count <> 12 then
            raise exception 'all 12 group standings must be entered before opening phase 2 (% of 12)',
                v_standings_count
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
