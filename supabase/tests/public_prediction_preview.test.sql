-- supabase/tests/public_prediction_preview.test.sql
--
-- Locks down the access gate of get_public_prediction (migrations 0057 +
-- 0058). A non-admin user may preview ANOTHER member's prediction only while
-- picks are frozen: during the Group Stage lock (phase1_locked) and once the
-- knockout bracket locks (phase2_locked). It stays hidden while picks are
-- editable (phase1 group picks, phase2_open knockout picks). Owners always see
-- their own; admins + super-admins always see everything. The paid +
-- (submitted OR phase1-complete) eligibility is preserved across all phases.
--
-- Phase is driven by mutating the tournament's lock_time / knockout_unlocked /
-- knockout_lock_time between assertion blocks (see tournament_phase in
-- migration 0022). The caller is impersonated via a transaction-local
-- request.jwt.claims so auth.uid() / is_admin() / is_super_admin() resolve.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(15);

-- ----- Helpers shared by this file only.

create or replace function pg_temp.fill_all_groups(p_prediction uuid) returns void
language sql as $$
    insert into public.group_predictions
        (prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id)
    select p_prediction, g.id,
           pg_temp.team_at(g.id, 0), pg_temp.team_at(g.id, 1),
           pg_temp.team_at(g.id, 2), pg_temp.team_at(g.id, 3)
    from public.groups g;
$$;

create or replace function pg_temp.fill_all_advancers(p_prediction uuid) returns void
language sql as $$
    insert into public.advancer_predictions (prediction_id, rank, team_id)
    select p_prediction, gs.rn, gs.third_team_id
    from (
        select row_number() over (order by group_id) as rn, third_team_id
        from public.group_predictions
        where prediction_id = p_prediction
        order by group_id
        limit 8
    ) gs;
$$;

-- Impersonate a caller for auth.uid()/is_admin()/is_super_admin().
create or replace function pg_temp.set_caller(p_uid uuid) returns void
language plpgsql as $$
begin
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
        true);
end $$;

-- Returns the single previewed row as jsonb (column names as keys), or NULL
-- when the access gate hides it (the route maps that to 404).
create or replace function pg_temp.preview_as(p_caller uuid, p_pred uuid) returns jsonb
language plpgsql as $$
declare r record;
begin
    perform pg_temp.set_caller(p_caller);
    select * into r from public.get_public_prediction(p_pred);
    if not found then return null; end if;
    return to_jsonb(r);
end $$;

-- Phase setters (mutate the single test tournament).
create or replace function pg_temp.go_phase(p_tid uuid, p_phase text) returns void
language plpgsql as $$
begin
    if p_phase = 'phase1' then
        update public.tournaments
           set lock_time = now() + interval '7 days',
               knockout_unlocked = false, knockout_lock_time = null
         where id = p_tid;
    elsif p_phase = 'phase1_locked' then
        update public.tournaments
           set lock_time = now() - interval '1 hour',
               knockout_unlocked = false, knockout_lock_time = null
         where id = p_tid;
    elsif p_phase = 'phase2_open' then
        update public.tournaments
           set lock_time = now() - interval '1 hour',
               knockout_unlocked = true, knockout_lock_time = now() + interval '1 day'
         where id = p_tid;
    elsif p_phase = 'phase2_locked' then
        update public.tournaments
           set lock_time = now() - interval '1 hour',
               knockout_unlocked = true, knockout_lock_time = now() - interval '1 hour'
         where id = p_tid;
    end if;
end $$;

-- ----- Fixtures.
do $$
declare
    v_owner uuid;
    v_other uuid;
    v_admin uuid;
    v_super uuid;
    v_tid   uuid;
begin
    v_owner := pg_temp.mk_user('preview_owner');
    v_other := pg_temp.mk_user('preview_other');   -- plain non-admin
    v_admin := pg_temp.mk_user('preview_admin');
    v_super := pg_temp.mk_user('preview_super');
    v_tid   := pg_temp.mk_tournament('preview gate', interval '-1 hour');

    perform pg_temp.put_id('owner', v_owner);
    perform pg_temp.put_id('other', v_other);
    perform pg_temp.put_id('admin', v_admin);
    perform pg_temp.put_id('super', v_super);
    perform pg_temp.put_id('t', v_tid);

    -- Both is_admin and is_super_admin flips are guarded by triggers that fire
    -- here because auth.uid() is null during setup (is_admin() -> false).
    -- Disable both for the seed, then re-enable.
    alter table public.profiles disable trigger profiles_block_admin_self_elevation;
    alter table public.profiles disable trigger profiles_block_super_admin_change;
    update public.profiles set is_admin = true where id = v_admin;
    update public.profiles set is_super_admin = true where id = v_super;
    alter table public.profiles enable trigger profiles_block_super_admin_change;
    alter table public.profiles enable trigger profiles_block_admin_self_elevation;

    -- Main prediction: paid (well in the past), submitted, full Phase 1 data,
    -- a champion pick, a tiebreaker, and a couple of knockout picks.
    perform pg_temp.put_id('p_main', pg_temp.mk_prediction(
        v_tid, v_owner, 'main pred', 12,
        now() - interval '20 days', true, now() - interval '30 days'));
    perform pg_temp.fill_all_groups(pg_temp.tid('p_main'));
    perform pg_temp.fill_all_advancers(pg_temp.tid('p_main'));
    update public.predictions
       set champion_team_id = pg_temp.team_at('A', 0)
     where id = pg_temp.tid('p_main');
    insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
    select pg_temp.tid('p_main'), km.id, pg_temp.team_at('A', 0)
      from public.knockout_matches km order by km.id limit 2;

    -- Unpaid but otherwise complete -> payment gate must still hide it.
    perform pg_temp.put_id('p_unpaid', pg_temp.mk_prediction(
        v_tid, v_owner, 'unpaid pred', 9,
        now() - interval '20 days', false));
    perform pg_temp.fill_all_groups(pg_temp.tid('p_unpaid'));
    perform pg_temp.fill_all_advancers(pg_temp.tid('p_unpaid'));

    -- Paid but incomplete draft (no groups/advancers, submitted_at null)
    -- -> eligibility filter must still hide it.
    perform pg_temp.put_id('p_incomplete', pg_temp.mk_prediction(
        v_tid, v_owner, 'incomplete pred', null,
        null, true, now() - interval '30 days'));
end $$;

-- ===== phase1: group picks still editable -> others hidden =====
select pg_temp.go_phase(pg_temp.tid('t'), 'phase1');
select ok(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main')) is null,
          'other user, phase1 -> hidden (404)');
select ok(pg_temp.preview_as(pg_temp.tid('owner'), pg_temp.tid('p_main')) is not null,
          'owner, phase1 -> sees own prediction');
select ok(pg_temp.preview_as(pg_temp.tid('admin'), pg_temp.tid('p_main')) is not null,
          'admin, phase1 -> staff bypass sees other prediction');

-- ===== phase1_locked: group stage frozen -> others may preview (NEW) =====
select pg_temp.go_phase(pg_temp.tid('t'), 'phase1_locked');
select ok(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main')) is not null,
          'other user, phase1_locked -> CAN preview (new behavior)');
select is(jsonb_array_length(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main'))->'groups'),
          12, 'other user, phase1_locked -> all 12 group picks visible');
select is(jsonb_array_length(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main'))->'advancers'),
          8, 'other user, phase1_locked -> all 8 advancer picks visible');
select ok((pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main'))->>'champion_team_id') is not null,
          'other user, phase1_locked -> gut-feeling champion visible');
select ok(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_unpaid')) is null,
          'other user, phase1_locked, unpaid prediction -> hidden (payment gate)');
select ok(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_incomplete')) is null,
          'other user, phase1_locked, incomplete draft -> hidden (eligibility)');

-- ===== phase2_open: knockout editable -> others restricted again (KEY) =====
select pg_temp.go_phase(pg_temp.tid('t'), 'phase2_open');
select ok(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main')) is null,
          'other user, phase2_open -> hidden again (knockout editable)');
select ok(pg_temp.preview_as(pg_temp.tid('owner'), pg_temp.tid('p_main')) is not null,
          'owner, phase2_open -> still sees own prediction');
select ok(pg_temp.preview_as(pg_temp.tid('super'), pg_temp.tid('p_main')) is not null,
          'super-admin, phase2_open -> staff bypass sees other prediction');

-- ===== phase2_locked: everything frozen -> full preview for all =====
select pg_temp.go_phase(pg_temp.tid('t'), 'phase2_locked');
select ok(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main')) is not null,
          'other user, phase2_locked -> can preview');
select ok(jsonb_array_length(pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main'))->'knockout') > 0,
          'other user, phase2_locked -> knockout bracket visible');
select is((pg_temp.preview_as(pg_temp.tid('other'), pg_temp.tid('p_main'))->>'total_goals')::int,
          12, 'other user, phase2_locked -> tiebreaker visible');

select * from finish();
rollback;
