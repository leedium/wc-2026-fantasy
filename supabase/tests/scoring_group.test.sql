-- supabase/tests/scoring_group.test.sql
--
-- Locks down group-stage scoring tiers in get_leaderboard
-- (migrations 0006 + 0031). Tiers per CLAUDE.md:
--   both correct exact order: 6 (8 for Group I)
--   both correct swapped:     4
--   one correct in same slot: 3
--   one correct in wrong slot:2
--   else:                     0

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(7);

do $$
declare
  v_user uuid;
  v_tid  uuid;
  a1 text; a2 text; a3 text; a4 text;
  i1 text; i2 text; i3 text; i4 text;
begin
  v_user := pg_temp.mk_user('scoring_group_user');
  v_tid  := pg_temp.mk_tournament('group scoring');
  perform pg_temp.put_id('t',    v_tid);
  perform pg_temp.put_id('user', v_user);

  a1 := pg_temp.team_at('A', 0); a2 := pg_temp.team_at('A', 1);
  a3 := pg_temp.team_at('A', 2); a4 := pg_temp.team_at('A', 3);
  i1 := pg_temp.team_at('I', 0); i2 := pg_temp.team_at('I', 1);
  i3 := pg_temp.team_at('I', 2); i4 := pg_temp.team_at('I', 3);

  -- Actual standings: A=[a1,a2,a3,a4], I=[i1,i2,i3,i4].
  insert into public.group_standings
    (tournament_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id)
  values
    (v_tid, 'A', a1, a2, a3, a4),
    (v_tid, 'I', i1, i2, i3, i4);

  -- One prediction per tier. Each only fills the group it is testing,
  -- so the other 11 groups contribute 0 and isolate the assertion.
  perform pg_temp.put_id('p_exact',     pg_temp.mk_prediction(v_tid, v_user, 'A exact'));
  perform pg_temp.put_id('p_swap',      pg_temp.mk_prediction(v_tid, v_user, 'A swap'));
  perform pg_temp.put_id('p_one_slot',  pg_temp.mk_prediction(v_tid, v_user, 'A one in slot'));
  perform pg_temp.put_id('p_one_wrong', pg_temp.mk_prediction(v_tid, v_user, 'A one wrong slot'));
  perform pg_temp.put_id('p_zero',      pg_temp.mk_prediction(v_tid, v_user, 'A zero'));
  perform pg_temp.put_id('p_i_exact',   pg_temp.mk_prediction(v_tid, v_user, 'I exact'));
  perform pg_temp.put_id('p_i_swap',    pg_temp.mk_prediction(v_tid, v_user, 'I swap'));

  insert into public.group_predictions
    (prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id)
  values
    (pg_temp.tid('p_exact'),     'A', a1, a2, a3, a4),
    (pg_temp.tid('p_swap'),      'A', a2, a1, a3, a4),
    (pg_temp.tid('p_one_slot'),  'A', a1, a3, a2, a4),  -- first correct, second wrong
    (pg_temp.tid('p_one_wrong'), 'A', a2, a3, a1, a4),  -- a2 in slot 1 instead of slot 2
    (pg_temp.tid('p_zero'),      'A', a3, a4, a1, a2),
    (pg_temp.tid('p_i_exact'),   'I', i1, i2, i3, i4),
    (pg_temp.tid('p_i_swap'),    'I', i2, i1, i3, i4);
end $$;

select is(pg_temp.lb_group(pg_temp.tid('t'), pg_temp.tid('p_exact')),     6,
          'group A exact top-2 -> 6');
select is(pg_temp.lb_group(pg_temp.tid('t'), pg_temp.tid('p_swap')),      4,
          'group A swapped top-2 -> 4');
select is(pg_temp.lb_group(pg_temp.tid('t'), pg_temp.tid('p_one_slot')),  3,
          'group A one correct in same slot -> 3');
select is(pg_temp.lb_group(pg_temp.tid('t'), pg_temp.tid('p_one_wrong')), 2,
          'group A one correct in wrong slot -> 2');
select is(pg_temp.lb_group(pg_temp.tid('t'), pg_temp.tid('p_zero')),      0,
          'group A neither top-2 picked -> 0');
select is(pg_temp.lb_group(pg_temp.tid('t'), pg_temp.tid('p_i_exact')),   8,
          'Group I (Group of Death) exact -> 8 (bonus)');
select is(pg_temp.lb_group(pg_temp.tid('t'), pg_temp.tid('p_i_swap')),    4,
          'Group I swapped -> 4 (no bonus on swap)');

select * from finish();
rollback;
