-- supabase/tests/scoring_tiebreaker.test.sql
--
-- Locks down the leaderboard ordering when point totals tie. Per the
-- row_number() OVER clause in get_leaderboard (0006/0031):
--   1. points DESC
--   2. abs(total_goals - tournaments.champion_total_goals) ASC NULLS LAST
--   3. submitted_at ASC
-- All predictions in this test score 0 points so the tiebreaker is the
-- only driver of the ranking.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(5);

do $$
declare
  v_user uuid;
  v_tid  uuid;
begin
  v_user := pg_temp.mk_user('scoring_tiebreaker_user');
  -- Champion scored 15 goals across the tournament.
  v_tid  := pg_temp.mk_tournament('tiebreaker scoring', interval '7 days', 15);
  perform pg_temp.put_id('t',    v_tid);
  perform pg_temp.put_id('user', v_user);

  -- Each prediction has identical (zero) points; only goals/submitted_at vary.
  perform pg_temp.put_id('p1_perfect_early',
    pg_temp.mk_prediction(v_tid, v_user, 'perfect goals early',   15, now() - interval '3 hours'));
  perform pg_temp.put_id('p2_perfect_late',
    pg_temp.mk_prediction(v_tid, v_user, 'perfect goals late',    15, now() - interval '1 hour'));
  perform pg_temp.put_id('p3_off_by_5_late',
    pg_temp.mk_prediction(v_tid, v_user, 'off by 5 later',        10, now() - interval '2 hours'));
  perform pg_temp.put_id('p4_off_by_5_early',
    pg_temp.mk_prediction(v_tid, v_user, 'off by 5 earlier',      20, now() - interval '4 hours'));
  perform pg_temp.put_id('p5_null_goals',
    pg_temp.mk_prediction(v_tid, v_user, 'null goals',          null, now() - interval '5 hours'));
end $$;

select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p1_perfect_early')), 1,
          'closest goal diff + earliest submitted_at -> rank 1');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p2_perfect_late')),  2,
          'closest goal diff but later submission -> rank 2');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p4_off_by_5_early')),3,
          'same goal diff as p3 but earlier submission wins the secondary tie');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p3_off_by_5_late')), 4,
          'same goal diff, later submission -> rank 4');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('p5_null_goals')),    5,
          'null total_goals -> ranked last (NULLS LAST on diff)');

select * from finish();
rollback;
