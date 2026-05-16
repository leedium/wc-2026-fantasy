-- supabase/tests/scoring_multi_prediction.test.sql
--
-- Locks down the multi-prediction leaderboard behavior introduced in 0012-0015:
--   * a single user can hold multiple paid predictions in the same tournament
--   * each paid prediction is its own leaderboard row (N paid predictions -> N rows)
--   * those rows are ranked GLOBALLY by points across all users — NOT bucketed
--     per user — so another user's prediction can interleave between two of
--     the same user's rows
--   * an unpaid prediction stays off the leaderboard even when other predictions
--     by the same user are eligible
--
-- Test layout:
--   User A   { high (6),  mid (4),  low (0),  high copy (6, unpaid) }
--   User B   { between (5 from a correct R32 pick) }
-- Expected leaderboard (high to low): a.high, b.between, a.mid, a.low.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(6);

do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_tid    uuid;
  a1 text; a2 text; a3 text; a4 text;
  w_m1 text; w_m1_l text;
begin
  v_user_a := pg_temp.mk_user('scoring_multi_a');
  v_user_b := pg_temp.mk_user('scoring_multi_b');
  v_tid    := pg_temp.mk_tournament('multi prediction');
  perform pg_temp.put_id('t', v_tid);

  a1 := pg_temp.team_at('A', 0); a2 := pg_temp.team_at('A', 1);
  a3 := pg_temp.team_at('A', 2); a4 := pg_temp.team_at('A', 3);
  w_m1 := pg_temp.team_at('B', 0); w_m1_l := pg_temp.team_at('B', 1);

  insert into public.group_standings
    (tournament_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id)
  values (v_tid, 'A', a1, a2, a3, a4);

  insert into public.knockout_results
    (tournament_id, match_id, winner_team_id, loser_team_id)
  values (v_tid, 'M1', w_m1, w_m1_l);

  -- User A: three eligible predictions (6 / 4 / 0) and one unpaid copy of high.
  perform pg_temp.put_id('a_high',   pg_temp.mk_prediction(v_tid, v_user_a, 'high'));
  perform pg_temp.put_id('a_mid',    pg_temp.mk_prediction(v_tid, v_user_a, 'mid'));
  perform pg_temp.put_id('a_low',    pg_temp.mk_prediction(v_tid, v_user_a, 'low'));
  perform pg_temp.put_id('a_unpaid', pg_temp.mk_prediction(
    v_tid, v_user_a, 'high copy', null, now(), false));

  insert into public.group_predictions
    (prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id)
  values
    (pg_temp.tid('a_high'),   'A', a1, a2, a3, a4),   -- exact -> 6
    (pg_temp.tid('a_mid'),    'A', a2, a1, a3, a4),   -- swap  -> 4
    (pg_temp.tid('a_unpaid'), 'A', a1, a2, a3, a4);   -- exact -> 6 but unpaid
  -- a_low: no group picks -> 0

  -- User B: one eligible prediction scoring 5 (R16 correct from M1).
  perform pg_temp.put_id('b_single', pg_temp.mk_prediction(v_tid, v_user_b, 'between'));
  insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
  values (pg_temp.tid('b_single'), 'M1', w_m1);
end $$;

select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('a_high')),   1,
          'user A high-score prediction (6 pts) -> rank 1');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('b_single')), 2,
          'user B prediction (5 pts) interleaves between two of user A''s rows -> rank 2');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('a_mid')),    3,
          'user A mid-score prediction (4 pts) -> rank 3');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('a_low')),    4,
          'user A zero-point prediction -> rank 4 (still on the board, just last)');
select is(pg_temp.lb_rank(pg_temp.tid('t'), pg_temp.tid('a_unpaid')), null,
          'user A unpaid prediction excluded even though other A predictions are eligible');
select is(pg_temp.lb_total_count(pg_temp.tid('t')), 4::bigint,
          'leaderboard surfaces 4 rows total (3 from user A + 1 from user B)');

select * from finish();
rollback;
