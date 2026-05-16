-- supabase/tests/scoring_phase1_complete_eligibility.test.sql
--
-- Locks down the relaxed eligibility filter in migration 0032: a paid
-- prediction with all 12 group + 8 advancer rows appears on the
-- leaderboard even when submitted_at is null (the user only ever
-- clicked "Save Phase 1 Picks" before the tournament locked). An
-- incomplete Phase 1 draft still stays hidden.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(5);

-- ----- Helpers shared by this file only.

-- Fills all 12 groups for a prediction with the alphabetical team order
-- for each group. Real picks don't matter — we just need 12 rows so
-- prediction_phase1_complete() returns true.
create or replace function pg_temp.fill_all_groups(p_prediction uuid) returns void
language sql as $$
    insert into public.group_predictions
        (prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id)
    select
        p_prediction,
        g.id,
        pg_temp.team_at(g.id, 0),
        pg_temp.team_at(g.id, 1),
        pg_temp.team_at(g.id, 2),
        pg_temp.team_at(g.id, 3)
    from public.groups g;
$$;

-- Fills 8 advancer rows for a prediction using its own 3rd-place picks.
-- The RPC enforces "team_id is in your 3rd-place picks" but we insert
-- directly here — the leaderboard scoring math doesn't validate that.
create or replace function pg_temp.fill_all_advancers(p_prediction uuid) returns void
language sql as $$
    insert into public.advancer_predictions (prediction_id, rank, team_id)
    select p_prediction, gs.rn, gs.third_team_id
    from (
        select
            row_number() over (order by group_id) as rn,
            third_team_id
        from public.group_predictions
        where prediction_id = p_prediction
        order by group_id
        limit 8
    ) gs;
$$;

do $$
declare
  v_user uuid;
  v_tid  uuid;
  v_lock timestamptz;
begin
  v_user := pg_temp.mk_user('phase1_complete_user');
  -- Past-lock so the tournament is in phase1_locked.
  v_tid  := pg_temp.mk_tournament('phase1 eligibility', interval '-1 hour');
  perform pg_temp.put_id('t',    v_tid);
  perform pg_temp.put_id('user', v_user);

  select lock_time into v_lock from public.tournaments where id = v_tid;

  -- (a) Paid, submitted_at null, all 12 groups + 8 advancers filled
  --     -> SHOULD appear on the leaderboard under the relaxed filter.
  perform pg_temp.put_id('p_phase1_complete', pg_temp.mk_prediction(
    v_tid, v_user, 'phase 1 complete draft', null, null, true, v_lock - interval '1 day'));
  perform pg_temp.fill_all_groups(pg_temp.tid('p_phase1_complete'));
  perform pg_temp.fill_all_advancers(pg_temp.tid('p_phase1_complete'));

  -- (b) Paid, submitted_at null, NO group or advancer rows
  --     -> stays excluded (the eligibility test already covers this;
  --     re-asserted here for symmetry).
  perform pg_temp.put_id('p_empty_draft', pg_temp.mk_prediction(
    v_tid, v_user, 'empty draft', null, null, true, v_lock - interval '1 day'));

  -- (c) Paid, submitted_at null, 12 groups but ONLY 4 advancers
  --     -> stays excluded (partial Phase 1 isn't enough).
  perform pg_temp.put_id('p_partial_advancers', pg_temp.mk_prediction(
    v_tid, v_user, 'partial advancers draft', null, null, true, v_lock - interval '1 day'));
  perform pg_temp.fill_all_groups(pg_temp.tid('p_partial_advancers'));
  insert into public.advancer_predictions (prediction_id, rank, team_id)
  select pg_temp.tid('p_partial_advancers'), rn, third_team_id
    from (
      select row_number() over (order by group_id) as rn, third_team_id
        from public.group_predictions
       where prediction_id = pg_temp.tid('p_partial_advancers')
       order by group_id
       limit 4
    ) s;

  -- (d) UNPAID complete Phase 1 draft -> still excluded (payment gate
  --     is independent of the submitted_at relaxation).
  perform pg_temp.put_id('p_unpaid_complete', pg_temp.mk_prediction(
    v_tid, v_user, 'unpaid complete draft', null, null, false));
  perform pg_temp.fill_all_groups(pg_temp.tid('p_unpaid_complete'));
  perform pg_temp.fill_all_advancers(pg_temp.tid('p_unpaid_complete'));
end $$;

select isnt(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_phase1_complete')), null,
            'paid + complete Phase 1 (submitted_at null) -> appears on leaderboard');
select is(  pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_empty_draft')),     null,
            'paid empty draft (submitted_at null) -> still excluded');
select is(  pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_partial_advancers')), null,
            'paid partial Phase 1 (4 of 8 advancers) -> still excluded');
select is(  pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_unpaid_complete')), null,
            'unpaid complete Phase 1 -> still excluded (payment gate intact)');
select is(  pg_temp.lb_total_count(pg_temp.tid('t')), 1::bigint,
            'total_count counts only the eligible Phase 1 draft');

select * from finish();
rollback;
