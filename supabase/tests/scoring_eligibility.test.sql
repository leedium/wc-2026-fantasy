-- supabase/tests/scoring_eligibility.test.sql
--
-- Locks down which predictions are eligible to appear on the leaderboard.
-- The CTE inside get_leaderboard filters out anything missing one of:
--   * p.submitted_at is not null
--   * a tournament_payments row for the prediction with
--     paid_at <= tournaments.lock_time

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(6);

do $$
declare
  v_user uuid;
  v_tid  uuid;
  v_lock timestamptz;
begin
  v_user := pg_temp.mk_user('scoring_eligibility_user');
  v_tid  := pg_temp.mk_tournament('eligibility', interval '7 days');
  perform pg_temp.put_id('t',    v_tid);
  perform pg_temp.put_id('user', v_user);

  select lock_time into v_lock from public.tournaments where id = v_tid;

  -- Paid one day before lock -> on leaderboard.
  perform pg_temp.put_id('p_paid_before', pg_temp.mk_prediction(
    v_tid, v_user, 'paid before lock', null, now(), true, v_lock - interval '1 day'));

  -- Paid exactly at lock_time -> on leaderboard (boundary, paid_at <= lock_time).
  perform pg_temp.put_id('p_paid_exact', pg_temp.mk_prediction(
    v_tid, v_user, 'paid at lock', null, now(), true, v_lock));

  -- Paid after lock_time -> filtered out.
  perform pg_temp.put_id('p_paid_after', pg_temp.mk_prediction(
    v_tid, v_user, 'paid after lock', null, now(), true, v_lock + interval '1 hour'));

  -- No payment row -> filtered out.
  perform pg_temp.put_id('p_unpaid', pg_temp.mk_prediction(
    v_tid, v_user, 'unpaid', null, now(), false));

  -- Paid in time but never submitted -> filtered out (submitted_at is null).
  perform pg_temp.put_id('p_unsubmitted', pg_temp.mk_prediction(
    v_tid, v_user, 'unsubmitted', null, null, true, v_lock - interval '1 day'));
end $$;

select isnt(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_paid_before')), null,
            'paid before lock -> appears on leaderboard');
select isnt(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_paid_exact')),  null,
            'paid_at = lock_time -> still appears (filter is <=)');
select is(  pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_paid_after')),  null,
            'paid after lock -> filtered out');
select is(  pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_unpaid')),      null,
            'no payment row -> filtered out');
select is(  pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p_unsubmitted')), null,
            'submitted_at null -> filtered out (even when paid in time)');
select is(  pg_temp.lb_total_count(pg_temp.tid('t')), 2::bigint,
            'total_count reflects only the 2 eligible predictions');

select * from finish();
rollback;
