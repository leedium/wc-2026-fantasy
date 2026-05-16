-- supabase/tests/scoring_knockout.test.sql
--
-- Locks down per-round knockout scoring + the champion / third-place
-- flat bonuses. Tier table per CLAUDE.md / 0006_scoring_v2.sql:
--   R16  (sourced from round_of_32):    correct slot +5,  wrong slot +3
--   QF   (sourced from round_of_16):    correct slot +6,  wrong slot +3
--   SF   (sourced from quarter_finals): correct slot +8,  wrong slot +4
--   Final(sourced from semi_finals):    correct slot +10, wrong slot +5
--   Bonuses: M32 (final winner) +15, M31 (third-place winner) +5

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(8);

do $$
declare
  v_user uuid;
  v_tid  uuid;
  -- Winners actually decided in each result row.
  w_m1   text; w_m1_l  text;
  w_m17  text; w_m17_l text;
  w_m25  text; w_m25_l text;
  w_m29  text; w_m29_l text;
  w_m31  text; w_m31_l text;
  w_m32  text; w_m32_l text;
  t_other text;
begin
  v_user := pg_temp.mk_user('scoring_knockout_user');
  v_tid  := pg_temp.mk_tournament('knockout scoring');
  perform pg_temp.put_id('t',    v_tid);
  perform pg_temp.put_id('user', v_user);

  -- Pick distinct teams to be the actual winners. Group choice is arbitrary;
  -- knockout_results doesn't validate against bracket sources.
  w_m1  := pg_temp.team_at('A', 0); w_m1_l  := pg_temp.team_at('A', 1);
  w_m17 := pg_temp.team_at('B', 0); w_m17_l := pg_temp.team_at('B', 1);
  w_m25 := pg_temp.team_at('C', 0); w_m25_l := pg_temp.team_at('C', 1);
  w_m29 := pg_temp.team_at('D', 0); w_m29_l := pg_temp.team_at('D', 1);
  w_m31 := pg_temp.team_at('E', 0); w_m31_l := pg_temp.team_at('E', 1);
  w_m32 := pg_temp.team_at('F', 0); w_m32_l := pg_temp.team_at('F', 1);
  t_other := pg_temp.team_at('L', 0);  -- a team that wins nothing

  insert into public.knockout_results
    (tournament_id, match_id, winner_team_id, loser_team_id)
  values
    (v_tid, 'M1',  w_m1,  w_m1_l),
    (v_tid, 'M17', w_m17, w_m17_l),
    (v_tid, 'M25', w_m25, w_m25_l),
    (v_tid, 'M29', w_m29, w_m29_l),
    (v_tid, 'M31', w_m31, w_m31_l),
    (v_tid, 'M32', w_m32, w_m32_l);

  perform pg_temp.put_id('p_r16_correct',    pg_temp.mk_prediction(v_tid, v_user, 'R16 correct slot'));
  perform pg_temp.put_id('p_r16_wrong_slot', pg_temp.mk_prediction(v_tid, v_user, 'R16 wrong slot'));
  perform pg_temp.put_id('p_r16_zero',       pg_temp.mk_prediction(v_tid, v_user, 'R16 zero'));
  perform pg_temp.put_id('p_qf_correct',     pg_temp.mk_prediction(v_tid, v_user, 'QF correct slot'));
  perform pg_temp.put_id('p_sf_correct',     pg_temp.mk_prediction(v_tid, v_user, 'SF correct slot'));
  perform pg_temp.put_id('p_final_correct',  pg_temp.mk_prediction(v_tid, v_user, 'Final correct slot'));
  perform pg_temp.put_id('p_champion',       pg_temp.mk_prediction(v_tid, v_user, 'M32 champion'));
  perform pg_temp.put_id('p_third',          pg_temp.mk_prediction(v_tid, v_user, 'M31 third place'));

  insert into public.knockout_predictions (prediction_id, match_id, winner_team_id) values
    (pg_temp.tid('p_r16_correct'),    'M1',  w_m1),
    -- wrong-slot: pick the right team but at a different R32 match.
    (pg_temp.tid('p_r16_wrong_slot'), 'M2',  w_m1),
    (pg_temp.tid('p_r16_zero'),       'M1',  t_other),
    (pg_temp.tid('p_qf_correct'),     'M17', w_m17),
    (pg_temp.tid('p_sf_correct'),     'M25', w_m25),
    (pg_temp.tid('p_final_correct'),  'M29', w_m29),
    (pg_temp.tid('p_champion'),       'M32', w_m32),
    (pg_temp.tid('p_third'),          'M31', w_m31);
end $$;

select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_r16_correct')),    5,
          'R16 correct-slot from round_of_32 -> +5');
select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_r16_wrong_slot')), 3,
          'R16 wrong-slot (winner picked in different R32 match) -> +3');
select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_r16_zero')),       0,
          'R16 no overlap with actual winner -> 0');
select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_qf_correct')),     6,
          'QF correct-slot from round_of_16 -> +6');
select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_sf_correct')),     8,
          'SF correct-slot from quarter_finals -> +8');
select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_final_correct')), 10,
          'Final correct-slot from semi_finals -> +10');
select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_champion')),      15,
          'M32 champion picked correctly -> +15');
select is(pg_temp.lb_knockout(pg_temp.tid('t'), pg_temp.tid('p_third')),          5,
          'M31 third-place picked correctly -> +5');

select * from finish();
rollback;
