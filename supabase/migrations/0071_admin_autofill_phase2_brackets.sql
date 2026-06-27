-- 0071_admin_autofill_phase2_brackets.sql
--
-- Auto-fill missing Phase 2 (knockout) brackets after the knockout deadline.
--
-- Some users pay and complete Phase 1 (groups + best-3rds + champion pick) but
-- forget to submit their knockout bracket before tournaments.knockout_lock_time.
-- Rather than let those paid entries score 0 on every knockout match, an admin
-- runs this AFTER the knockout deadline to fill the gaps with a sensible default
-- so the entry stays competitive. It NEVER overwrites a pick the user did make.
--
-- This re-implements, in SQL, the bracket source resolution that otherwise lives
-- only in the client (frontend/src/lib/knockoutResolver.ts) plus a winner rule.
--
--   Fill rule (per match, only when the user left it blank):
--     1. Resolve the two real teams from admin-entered results
--        (group_standings + r32_bracket_assignments), then from already-decided
--        winners for later rounds, and SF losers for the third-place match.
--     2. Champion override: if one of the two teams is the prediction's
--        champion_team_id, the champion wins (carries it down its real path,
--        incl. winning M104 if it gets there).
--     3. Else the team with the better real group finish wins (1st > 2nd > 3rd).
--     4. Tie (equal finish, neither is champion): team1 / team1_source side wins.
--        Arbitrary-but-stable — `teams` carries no seed/ranking to break it.
--
--   Tiebreaker (predictions.total_goals): when null, set to the median of
--   on-time submitters' total_goals (fallback constant 12, a realistic champion
--   5-match playoff total inside the 0..200 CHECK). Never overwrites a user value.
--
--   updated_at: stamped to now() on touched predictions. Because this runs after
--   the deadline, now() is later than every genuine on-time edit, so auto-filled
--   entries sort LAST within a points/goal-closeness tie on the leaderboard
--   (which tiebreaks on updated_at — see 0069). submitted_at is left untouched.
--
-- Super-admin gated, idempotent (re-running fills only still-missing matches),
-- and scoped to leaderboard entries only (paid OR is_free credit — the
-- `paid_at <= lock_time` predicate, lifted verbatim from get_leaderboard / 0070).

-- ========== helper: _autofill_seed ==========
-- A team's real group finish for the seed rule: 1 (won group), 2, 3, 4.
-- Falls back to 9 when the team isn't found in standings (defensive; resolved
-- knockout teams always finished 1st/2nd/3rd, so this never bites in practice).

create or replace function public._autofill_seed(p_tournament_id uuid, p_team_id text)
returns int
language sql
stable
set search_path = public
as $$
    select coalesce(min(pos), 9) from (
        select 1 as pos from public.group_standings
            where tournament_id = p_tournament_id and first_team_id = p_team_id
        union all
        select 2 from public.group_standings
            where tournament_id = p_tournament_id and second_team_id = p_team_id
        union all
        select 3 from public.group_standings
            where tournament_id = p_tournament_id and third_team_id = p_team_id
        union all
        select 4 from public.group_standings
            where tournament_id = p_tournament_id and fourth_team_id = p_team_id
    ) s;
$$;

revoke all on function public._autofill_seed(uuid, text) from public;

-- ========== helper: _autofill_resolve_source ==========
-- Mirror of resolveTeamSource for the Phase 2 (post-deadline) path: group
-- positions resolve from admin group_standings ONLY (never the user's Phase 1
-- guesses), '3-...' from r32_bracket_assignments, 'M..' from the working winners
-- map (p_winners: {match_id -> winner_team_id}), and 'L-M..' from the SF result.
-- Returns null when a source can't be resolved.

create or replace function public._autofill_resolve_source(
    p_tournament_id uuid,
    p_source text,
    p_winners jsonb
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
    v_pos text;
    v_group text;
    v_team text;
    v_inner_id text;
    v_slot smallint;
    v_inner_winner text;
    v_src1 text;
    v_src2 text;
    v_it1 text;
    v_it2 text;
begin
    -- Group position: '1A' = 1st of Group A, '2B', '3A', ...
    if p_source ~ '^[123][A-L]$' then
        v_pos := substring(p_source from 1 for 1);
        v_group := substring(p_source from 2 for 1);
        select case v_pos
                   when '1' then first_team_id
                   when '2' then second_team_id
                   when '3' then third_team_id
               end
            into v_team
            from public.group_standings
            where tournament_id = p_tournament_id and group_id = v_group;
        if v_team is null then
            return null;
        end if;
        -- Dedupe: if this team is placed in a 3-XXXX R32 slot, it materializes
        -- there instead — suppress here (matches resolver lines 69-76).
        if exists (
            select 1 from public.r32_bracket_assignments
            where tournament_id = p_tournament_id and team_id = v_team
        ) then
            return null;
        end if;
        return v_team;
    end if;

    -- Best-3rd bracket slot: '3-ABCDF' -> the admin-assigned advancer for the
    -- (match_id, slot) tuple that owns this source string.
    if p_source ~ '^3-[A-L]+$' then
        select km.id,
               (case when km.team1_source = p_source then 1 else 2 end)::smallint
            into v_inner_id, v_slot
            from public.knockout_matches km
            where km.team1_source = p_source or km.team2_source = p_source
            limit 1;
        if v_inner_id is null then
            return null;
        end if;
        select team_id into v_team
            from public.r32_bracket_assignments
            where tournament_id = p_tournament_id
              and match_id = v_inner_id
              and slot = v_slot;
        return v_team;
    end if;

    -- Match winner: 'M73' -> the (already-decided) winner of that match.
    if p_source ~ '^M\d+$' then
        return p_winners->>p_source;
    end if;

    -- Match loser: 'L-M101' -> resolve M101's two teams + winner, return the
    -- one that is not the winner (third-place feeders).
    if p_source ~ '^L-M\d+$' then
        v_inner_id := substring(p_source from 3);   -- 'L-M101' -> 'M101'
        v_inner_winner := p_winners->>v_inner_id;
        if v_inner_winner is null then
            return null;
        end if;
        select team1_source, team2_source into v_src1, v_src2
            from public.knockout_matches where id = v_inner_id;
        if v_src1 is null then
            return null;
        end if;
        v_it1 := public._autofill_resolve_source(p_tournament_id, v_src1, p_winners);
        v_it2 := public._autofill_resolve_source(p_tournament_id, v_src2, p_winners);
        if v_inner_winner = v_it1 then
            return v_it2;
        elsif v_inner_winner = v_it2 then
            return v_it1;
        end if;
        return null;
    end if;

    return null;
end;
$$;

revoke all on function public._autofill_resolve_source(uuid, text, jsonb) from public;

-- ========== admin_autofill_phase2_preview ==========
-- Read-only: guards + eligibility count, used by the admin UI before the write.

create or replace function public.admin_autofill_phase2_preview(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_eligible int := 0;
    v_resolution_ok boolean := true;
    v_slot_count int;
    v_assign_count int;
begin
    if not public.is_super_admin() then
        raise exception 'forbidden';
    end if;
    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found';
    end if;

    if (select count(*) from public.group_standings where tournament_id = p_tournament_id) <> 12 then
        v_resolution_ok := false;
    else
        select
            (select count(*) from public.knockout_matches
                where stage = 'round_of_32' and team1_source like '3-%')
          + (select count(*) from public.knockout_matches
                where stage = 'round_of_32' and team2_source like '3-%')
            into v_slot_count;
        select count(*) into v_assign_count
            from public.r32_bracket_assignments where tournament_id = p_tournament_id;
        if v_assign_count < v_slot_count then
            v_resolution_ok := false;
        end if;
    end if;

    select count(*) into v_eligible
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
          ) < (select count(*) from public.knockout_matches);

    return jsonb_build_object(
        'eligible_count', v_eligible,
        'resolution_data_ok', v_resolution_ok,
        'phase', public.tournament_phase(p_tournament_id)
    );
end;
$$;

revoke all on function public.admin_autofill_phase2_preview(uuid) from public;
grant execute on function public.admin_autofill_phase2_preview(uuid) to authenticated;

-- ========== admin_autofill_phase2_brackets ==========

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
    -- ----- guards -----
    if not public.is_super_admin() then
        raise exception 'forbidden';
    end if;
    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found';
    end if;
    if public.tournament_phase(p_tournament_id) <> 'phase2_locked' then
        raise exception 'tournament is not phase2_locked';
    end if;

    -- Resolution data must exist or we'd write NULL winners. (Phase 2 can't open
    -- without it, but check defensively.)
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

    -- ----- tiebreaker default (median of on-time submitters; fallback 12) -----
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

    -- ----- per eligible prediction -----
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

        -- Seed the working winners map from the user's existing (non-null) picks
        -- so downstream rounds cascade from them and we never overwrite them.
        select coalesce(jsonb_object_agg(kp.match_id, kp.winner_team_id), '{}'::jsonb)
            into v_winners
            from public.knockout_predictions kp
            where kp.prediction_id = v_pred.id and kp.winner_team_id is not null;

        for v_match in
            select id, team1_source, team2_source
                from public.knockout_matches
                order by match_order
        loop
            -- Already decided (user pick or filled earlier this run) -> keep it.
            if v_winners ? v_match.id then
                continue;
            end if;

            v_t1 := public._autofill_resolve_source(p_tournament_id, v_match.team1_source, v_winners);
            v_t2 := public._autofill_resolve_source(p_tournament_id, v_match.team2_source, v_winners);

            if v_t1 is null and v_t2 is null then
                continue;                                   -- unresolvable, skip
            elsif v_t1 is null then
                v_winner := v_t2;
            elsif v_t2 is null then
                v_winner := v_t1;
            elsif v_t1 = v_champion then
                v_winner := v_t1;                           -- champion override
            elsif v_t2 = v_champion then
                v_winner := v_t2;
            elsif public._autofill_seed(p_tournament_id, v_t1)
                  <= public._autofill_seed(p_tournament_id, v_t2) then
                v_winner := v_t1;                           -- better/equal seed (tie -> team1)
            else
                v_winner := v_t2;
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
