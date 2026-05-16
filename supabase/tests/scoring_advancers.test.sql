-- supabase/tests/scoring_advancers.test.sql
--
-- Locks down the ranked-advancer scoring weights set in 0031:
--   exact rank match in top-8 : 1.25
--   anywhere in top-8 set      : 1.00
--   else                       : 0
--   max (8 exact)              : 10.00

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
\ir lib/_fixtures.psql

select plan(4);

do $$
declare
  v_user uuid;
  v_tid  uuid;
  -- 8 teams that will be the actual advancers (any teams, no group_standings needed
  -- because we bypass admin_set_tournament_advancer and write the table directly).
  adv text[];
  -- 8 teams that are NOT in the advancers set.
  out_set text[];
  i int;
begin
  v_user := pg_temp.mk_user('scoring_advancers_user');
  v_tid  := pg_temp.mk_tournament('advancer scoring');
  perform pg_temp.put_id('t',    v_tid);
  perform pg_temp.put_id('user', v_user);

  adv := array[
    pg_temp.team_at('A', 0), pg_temp.team_at('B', 0),
    pg_temp.team_at('C', 0), pg_temp.team_at('D', 0),
    pg_temp.team_at('E', 0), pg_temp.team_at('F', 0),
    pg_temp.team_at('G', 0), pg_temp.team_at('H', 0)
  ];
  out_set := array[
    pg_temp.team_at('I', 0), pg_temp.team_at('I', 1),
    pg_temp.team_at('J', 0), pg_temp.team_at('J', 1),
    pg_temp.team_at('K', 0), pg_temp.team_at('K', 1),
    pg_temp.team_at('L', 0), pg_temp.team_at('L', 1)
  ];

  for i in 1..8 loop
    insert into public.tournament_advancers (tournament_id, rank, team_id)
      values (v_tid, i, adv[i]);
  end loop;

  perform pg_temp.put_id('p_all_exact',     pg_temp.mk_prediction(v_tid, v_user, 'all 8 exact'));
  perform pg_temp.put_id('p_all_wrong_rank',pg_temp.mk_prediction(v_tid, v_user, 'all 8 wrong rank'));
  perform pg_temp.put_id('p_half_miss',     pg_temp.mk_prediction(v_tid, v_user, '4 exact and 4 miss'));
  perform pg_temp.put_id('p_zero',          pg_temp.mk_prediction(v_tid, v_user, '0 in top-8'));

  -- p_all_exact: 8 picks all in exact rank -> 8 * 1.25 = 10.0
  for i in 1..8 loop
    insert into public.advancer_predictions (prediction_id, rank, team_id)
      values (pg_temp.tid('p_all_exact'), i, adv[i]);
  end loop;

  -- p_all_wrong_rank: every team in set but rotated one slot -> 8 * 1.0 = 8.0
  for i in 1..8 loop
    insert into public.advancer_predictions (prediction_id, rank, team_id)
      values (pg_temp.tid('p_all_wrong_rank'), i, adv[((i % 8) + 1)]);
  end loop;

  -- p_half_miss: ranks 1..4 exact, ranks 5..8 outside the set ->
  --   4 * 1.25 + 4 * 0 = 5.0
  for i in 1..4 loop
    insert into public.advancer_predictions (prediction_id, rank, team_id)
      values (pg_temp.tid('p_half_miss'), i, adv[i]);
  end loop;
  for i in 5..8 loop
    insert into public.advancer_predictions (prediction_id, rank, team_id)
      values (pg_temp.tid('p_half_miss'), i, out_set[i]);
  end loop;

  -- p_zero: every pick outside the set -> 0
  for i in 1..8 loop
    insert into public.advancer_predictions (prediction_id, rank, team_id)
      values (pg_temp.tid('p_zero'), i, out_set[i]);
  end loop;
end $$;

select is(pg_temp.lb_advancers(pg_temp.tid('t'), pg_temp.tid('p_all_exact')),       10.0::numeric,
          '8 advancers picked in exact rank -> 10.0 (max)');
select is(pg_temp.lb_advancers(pg_temp.tid('t'), pg_temp.tid('p_all_wrong_rank')),   8.0::numeric,
          '8 advancers all in set but every rank wrong -> 8.0');
select is(pg_temp.lb_advancers(pg_temp.tid('t'), pg_temp.tid('p_half_miss')),        5.0::numeric,
          '4 exact + 4 not in set -> 5.0');
select is(pg_temp.lb_advancers(pg_temp.tid('t'), pg_temp.tid('p_zero')),             0::numeric,
          '0 picks in top-8 set -> 0');

select * from finish();
rollback;
