-- 0074_autofill_fifa_ranking_tiebreak.sql
--
-- Break autofill ties by FIFA ranking instead of the arbitrary slot-1 fallback.
--
-- The outcome-blind autofill rule (champion -> better group finish -> ???) used
-- the team1_source side whenever two teams had the SAME real group finish, only
-- because `teams` carried no ranking to decide it more meaningfully. We now add a
-- `fifa_ranking` column (populated from the FIFA Men's World Ranking, mirroring
-- frontend/src/lib/fifaRankings.ts) and use it as the tiebreaker: on equal group
-- finish, the higher-ranked team (lower number) wins; slot-1 remains the final
-- fallback only when a ranking is missing or also tied.
--
-- The winner rule is extracted into one helper, public._autofill_pick_winner,
-- so both autofills (admin_autofill_phase2_brackets [0071], whole-bracket; and
-- admin_autofill_locked_fixtures [0072], per-fixture) share it and can't drift.
--
-- NOTE: rankings are now duplicated (this column + fifaRankings.ts, which the
-- client uses for its own group/advancer autofills). Refresh BOTH together after
-- each official FIFA ranking publication.

-- ========== teams.fifa_ranking column + data ==========

alter table public.teams add column if not exists fifa_ranking int;

update public.teams t set fifa_ranking = f.rank
  from (values
    ('ESP',1),('ARG',2),('FRA',3),('ENG',4),('BRA',5),('POR',6),('NED',7),('BEL',8),('CRO',9),('GER',11),
    ('MAR',12),('COL',13),('URU',14),('USA',15),('MEX',16),('SUI',17),('SEN',18),('JPN',19),('IRN',21),('KOR',22),
    ('ECU',24),('AUS',25),('AUT',26),('CAN',28),('TUR',30),('NOR',32),('SWE',33),('ALG',36),('CZE',37),('EGY',38),
    ('SCO',39),('CIV',40),('PAN',41),('PAR',45),('QAT',50),('TUN',51),('UZB',55),('RSA',58),('KSA',59),('COD',60),
    ('CPV',62),('JOR',64),('IRQ',68),('BIH',75),('CUW',80),('HAI',85),('GHA',86),('NZL',88)
  ) as f(code, rank)
 where t.code = f.code;

-- Fail loudly if any team was left unranked (a code mismatch would silently
-- degrade the tiebreaker back to slot-1 for that team).
do $$
declare v_missing int;
begin
    select count(*) into v_missing from public.teams where fifa_ranking is null;
    if v_missing > 0 then
        raise exception 'fifa_ranking not populated for % team(s)', v_missing;
    end if;
end $$;

-- ========== helper: _autofill_pick_winner ==========
-- The single source of truth for the outcome-blind autofill winner rule:
--   1. only one side resolved      -> that team (null if neither resolves)
--   2. champion override            -> the entry's champion if it's in the match
--   3. better real group finish     -> 1st > 2nd > 3rd (lower _autofill_seed)
--   4. equal finish                 -> better FIFA ranking (lower number)
--   5. missing/equal ranking        -> stable slot-1 (team1) fallback

create or replace function public._autofill_pick_winner(
    p_tournament_id uuid,
    p_team1 text,
    p_team2 text,
    p_champion text
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
    s1 int; s2 int; r1 int; r2 int;
begin
    if p_team1 is null and p_team2 is null then return null; end if;
    if p_team1 is null then return p_team2; end if;
    if p_team2 is null then return p_team1; end if;

    if p_team1 = p_champion then return p_team1; end if;
    if p_team2 = p_champion then return p_team2; end if;

    s1 := public._autofill_seed(p_tournament_id, p_team1);
    s2 := public._autofill_seed(p_tournament_id, p_team2);
    if s1 < s2 then return p_team1; end if;
    if s2 < s1 then return p_team2; end if;

    -- Equal group finish: break by FIFA ranking (lower number = better team),
    -- then fall back to the slot-1 side when a ranking is missing or also tied.
    select fifa_ranking into r1 from public.teams where id = p_team1;
    select fifa_ranking into r2 from public.teams where id = p_team2;
    if coalesce(r1, 2147483647) <= coalesce(r2, 2147483647) then
        return p_team1;
    else
        return p_team2;
    end if;
end;
$$;

revoke all on function public._autofill_pick_winner(uuid, text, text, text) from public;

-- ========== admin_autofill_phase2_brackets (re-emit from 0071, shared rule) ==========

create or replace function public.admin_autofill_phase2_brackets(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_eligible int := 0;
    v_touched int := 0;
    v_filled int := 0;
    v_default_goals int;
    v_slot_count int;
    v_assign_count int;
    v_pred record;
    v_match record;
    v_winners jsonb;
    v_champion text;
    v_t1 text;
    v_t2 text;
    v_winner text;
    v_pred_filled int;
begin
    if not public.is_super_admin() then
        raise exception 'forbidden';
    end if;
    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found';
    end if;
    if public.tournament_phase(p_tournament_id) <> 'phase2_locked' then
        raise exception 'tournament is not phase2_locked';
    end if;

    if (select count(*) from public.group_standings where tournament_id = p_tournament_id) <> 12 then
        raise exception 'resolution data incomplete';
    end if;
    select
        (select count(*) from public.knockout_matches
            where stage = 'round_of_32' and team1_source like '3-%')
      + (select count(*) from public.knockout_matches
            where stage = 'round_of_32' and team2_source like '3-%')
        into v_slot_count;
    select count(*) into v_assign_count
        from public.r32_bracket_assignments where tournament_id = p_tournament_id;
    if v_assign_count < v_slot_count then
        raise exception 'resolution data incomplete';
    end if;

    select percentile_cont(0.5) within group (order by p.total_goals)::int
        into v_default_goals
        from public.predictions p
        where p.tournament_id = p_tournament_id
          and p.total_goals is not null
          and exists (
              select 1 from public.tournament_payments tp
              join public.tournaments t on t.id = tp.tournament_id
              where tp.prediction_id = p.id and tp.paid_at <= t.lock_time
          );
    if v_default_goals is null then
        v_default_goals := 12;
    end if;

    for v_pred in
        select p.id, p.champion_team_id
            from public.predictions p
            where p.tournament_id = p_tournament_id
              and p.champion_team_id is not null
              and public.prediction_phase1_complete(p.id)
              and exists (
                  select 1 from public.tournament_payments tp
                  join public.tournaments t on t.id = tp.tournament_id
                  where tp.prediction_id = p.id and tp.paid_at <= t.lock_time
              )
              and (
                  select count(*) from public.knockout_predictions kp
                  where kp.prediction_id = p.id and kp.winner_team_id is not null
              ) < (select count(*) from public.knockout_matches)
    loop
        v_eligible := v_eligible + 1;
        v_champion := v_pred.champion_team_id;
        v_pred_filled := 0;

        select coalesce(jsonb_object_agg(kp.match_id, kp.winner_team_id), '{}'::jsonb)
            into v_winners
            from public.knockout_predictions kp
            where kp.prediction_id = v_pred.id and kp.winner_team_id is not null;

        for v_match in
            select id, team1_source, team2_source
                from public.knockout_matches
                order by match_order
        loop
            if v_winners ? v_match.id then
                continue;
            end if;

            v_t1 := public._autofill_resolve_source(p_tournament_id, v_match.team1_source, v_winners);
            v_t2 := public._autofill_resolve_source(p_tournament_id, v_match.team2_source, v_winners);

            v_winner := public._autofill_pick_winner(p_tournament_id, v_t1, v_t2, v_champion);
            if v_winner is null then
                continue;                                   -- both sides unresolvable
            end if;

            v_winners := jsonb_set(v_winners, array[v_match.id], to_jsonb(v_winner));

            insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
                values (v_pred.id, v_match.id, v_winner)
                on conflict (prediction_id, match_id)
                do update set winner_team_id = excluded.winner_team_id
                where public.knockout_predictions.winner_team_id is null;

            v_pred_filled := v_pred_filled + 1;
            v_filled := v_filled + 1;
        end loop;

        if v_pred_filled > 0 then
            v_touched := v_touched + 1;
            update public.predictions
                set total_goals = coalesce(total_goals, v_default_goals),
                    updated_at = now()
                where id = v_pred.id;
        end if;
    end loop;

    return jsonb_build_object(
        'predictions_eligible', v_eligible,
        'predictions_touched', v_touched,
        'matches_filled', v_filled
    );
end;
$$;

revoke all on function public.admin_autofill_phase2_brackets(uuid) from public;
grant execute on function public.admin_autofill_phase2_brackets(uuid) to authenticated;

-- ========== admin_autofill_locked_fixtures (re-emit from 0072, shared rule) ==========

create or replace function public.admin_autofill_locked_fixtures(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_eligible int := 0;
    v_touched int := 0;
    v_filled int := 0;
    v_phase text;
    v_pred record;
    v_match record;
    v_winners jsonb;
    v_champion text;
    v_t1 text;
    v_t2 text;
    v_winner text;
    v_pred_filled int;
begin
    if not public.is_super_admin() then
        raise exception 'forbidden';
    end if;
    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found';
    end if;
    v_phase := public.tournament_phase(p_tournament_id);
    if v_phase not in ('phase2_open', 'phase2_locked') then
        raise exception 'knockout phase is not open';
    end if;

    if (select count(*) from public.group_standings where tournament_id = p_tournament_id) <> 12 then
        raise exception 'resolution data incomplete';
    end if;

    if not exists (
        select 1 from public.knockout_match_locks
        where tournament_id = p_tournament_id and now() >= locked_at
    ) then
        return jsonb_build_object(
            'predictions_eligible', 0, 'predictions_touched', 0, 'matches_filled', 0
        );
    end if;

    for v_pred in
        select p.id, p.champion_team_id
            from public.predictions p
            where p.tournament_id = p_tournament_id
              and p.champion_team_id is not null
              and public.prediction_phase1_complete(p.id)
              and exists (
                  select 1 from public.tournament_payments tp
                  join public.tournaments t on t.id = tp.tournament_id
                  where tp.prediction_id = p.id and tp.paid_at <= t.lock_time
              )
    loop
        v_eligible := v_eligible + 1;
        v_champion := v_pred.champion_team_id;
        v_pred_filled := 0;

        select coalesce(jsonb_object_agg(kp.match_id, kp.winner_team_id), '{}'::jsonb)
            into v_winners
            from public.knockout_predictions kp
            where kp.prediction_id = v_pred.id and kp.winner_team_id is not null;

        for v_match in
            select id, team1_source, team2_source
                from public.knockout_matches
                order by match_order
        loop
            if v_winners ? v_match.id then
                continue;
            end if;
            if not public.is_knockout_match_locked(p_tournament_id, v_match.id) then
                continue;
            end if;

            v_t1 := public._autofill_resolve_source(p_tournament_id, v_match.team1_source, v_winners);
            v_t2 := public._autofill_resolve_source(p_tournament_id, v_match.team2_source, v_winners);

            v_winner := public._autofill_pick_winner(p_tournament_id, v_t1, v_t2, v_champion);
            if v_winner is null then
                continue;
            end if;

            v_winners := jsonb_set(v_winners, array[v_match.id], to_jsonb(v_winner));

            insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
                values (v_pred.id, v_match.id, v_winner)
                on conflict (prediction_id, match_id)
                do update set winner_team_id = excluded.winner_team_id
                where public.knockout_predictions.winner_team_id is null;

            v_pred_filled := v_pred_filled + 1;
            v_filled := v_filled + 1;
        end loop;

        if v_pred_filled > 0 then
            v_touched := v_touched + 1;
        end if;
    end loop;

    return jsonb_build_object(
        'predictions_eligible', v_eligible,
        'predictions_touched', v_touched,
        'matches_filled', v_filled
    );
end;
$$;

revoke all on function public.admin_autofill_locked_fixtures(uuid) from public;
grant execute on function public.admin_autofill_locked_fixtures(uuid) to authenticated;
