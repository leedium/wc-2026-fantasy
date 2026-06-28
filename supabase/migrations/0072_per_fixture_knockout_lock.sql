-- 0072_per_fixture_knockout_lock.sql
--
-- Per-fixture (progressive) knockout locking.
--
-- The Phase 2 window is otherwise all-or-nothing: an admin opens Phase 2
-- (knockout_unlocked = true + a single knockout_lock_time) and EVERY knockout
-- pick stays editable until that one deadline, then all freeze together. The
-- WC2026 schedule makes that impossible: the group stage ends only hours before
-- the first knockout match (M73) kicks off, and later R32 fixtures kick off over
-- the following days. We want to keep the window open late so users can keep
-- tuning later rounds, but lock EACH fixture individually at its own kickoff so
-- no pick can change once a match has started.
--
-- Model: a per-(tournament, match) `locked_at` timestamp. A fixture is locked
-- when now() >= locked_at. The admin sets it to the fixture's kickoff in advance
-- (auto-applies) or to now() to lock immediately. This layers ON TOP of the
-- existing global knockout_lock_time, which stays as a backstop.
--
-- Enforcement lives at the RPC boundary: submit_predictions / admin_submit_predictions
-- preserve a locked fixture's stored pick and silently ignore incoming changes to
-- it, while every other fixture stays editable. The lock is honored uniformly for
-- everyone (including super-admin via admin_submit_predictions): to correct a
-- locked pick an admin must unlock the fixture, edit, then re-lock.
--
-- For users who left a now-locked fixture blank, admin_autofill_locked_fixtures
-- fills it with the existing outcome-blind rule from 0071 (champion override ->
-- better real group finish -> slot-1 tiebreak). Because that rule never reads
-- knockout_results, running it at a fixture's kickoff is a forecast, not a backfill.

-- ========== table: knockout_match_locks ==========

create table if not exists public.knockout_match_locks (
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    match_id      text not null references public.knockout_matches(id),
    locked_at     timestamptz not null,
    primary key (tournament_id, match_id)
);

alter table public.knockout_match_locks enable row level security;

-- Lock times aren't secret; the prediction wizard needs them to disable cards.
-- Read-all; no client writes (all mutations go through the admin RPC below).
drop policy if exists knockout_match_locks_select_all on public.knockout_match_locks;
create policy knockout_match_locks_select_all
    on public.knockout_match_locks for select using (true);

-- ========== helper: is_knockout_match_locked ==========

create or replace function public.is_knockout_match_locked(
    p_tournament_id uuid,
    p_match_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.knockout_match_locks
        where tournament_id = p_tournament_id
          and match_id = p_match_id
          and now() >= locked_at
    );
$$;

grant execute on function public.is_knockout_match_locked(uuid, text) to authenticated;

-- ========== admin RPC: admin_set_knockout_match_lock ==========
-- p_locked_at = null  -> unlock (delete the row)   [the "unlock" half of
--                                                    unlock -> edit -> re-lock]
-- p_locked_at set     -> schedule/set the lock time (upsert)

create or replace function public.admin_set_knockout_match_lock(
    p_tournament_id uuid,
    p_match_id text,
    p_locked_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.tournaments where id = p_tournament_id) then
        raise exception 'tournament not found' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.knockout_matches where id = p_match_id) then
        raise exception 'match not found' using errcode = 'P0001';
    end if;

    if p_locked_at is null then
        delete from public.knockout_match_locks
            where tournament_id = p_tournament_id and match_id = p_match_id;
    else
        insert into public.knockout_match_locks (tournament_id, match_id, locked_at)
            values (p_tournament_id, p_match_id, p_locked_at)
            on conflict (tournament_id, match_id)
            do update set locked_at = excluded.locked_at;
    end if;
end;
$$;

revoke all on function public.admin_set_knockout_match_lock(uuid, text, timestamptz) from public;
grant execute on function public.admin_set_knockout_match_lock(uuid, text, timestamptz) to authenticated;

-- ========== submit_predictions (re-emit from 0050, per-fixture lock guard) ==========
-- Verbatim re-emit of the 0050 body. ONLY the phase2_open knockout write block
-- changes: instead of "delete all + reinsert all", it deletes only UNLOCKED
-- fixtures and skips locked fixtures on insert, so a locked fixture's stored pick
-- is authoritative and incoming changes to it are silently ignored.

create or replace function public.submit_predictions(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tournament_id uuid := (payload->>'tournament_id')::uuid;
    v_prediction_id uuid := nullif(payload->>'prediction_id', '')::uuid;
    v_prediction_name text := nullif(trim(payload->>'prediction_name'), '');
    v_total_goals int := nullif(payload->>'total_goals', '')::int;
    v_champion_team_id text := nullif(payload->>'champion_team_id', '');
    v_has_champion_key boolean := payload ? 'champion_team_id';
    v_mark_submitted boolean := coalesce((payload->>'submit')::boolean, true);
    v_user uuid := auth.uid();
    v_phase text;
    v_has_phase1_fields boolean;
    v_has_phase2_fields boolean;
    v_group jsonb;
    v_match jsonb;
    v_advancer jsonb;
    v_rank int;
    v_team_id text;
    v_seen_ranks int[] := '{}';
    v_seen_teams text[] := '{}';
    v_valid_thirds text[];
    v_group_id text;
    v_team_ids text[];
    v_mismatched_team text;
begin
    if v_user is null then
        raise exception 'not authenticated';
    end if;

    v_phase := public.tournament_phase(v_tournament_id);

    if v_prediction_id is null and v_phase <> 'phase1' then
        raise exception 'phase 1 ended; new predictions cannot be created'
            using errcode = 'P0001';
    end if;

    v_has_phase1_fields := (payload ? 'groups' and jsonb_array_length(payload->'groups') > 0)
        or (payload ? 'advancers' and jsonb_array_length(payload->'advancers') > 0)
        or v_has_champion_key;
    v_has_phase2_fields := (payload ? 'knockout' and jsonb_array_length(payload->'knockout') > 0)
        or (v_total_goals is not null);

    if v_phase = 'phase1_locked' or v_phase = 'phase2_locked' then
        raise exception 'predictions are locked';
    end if;

    if v_phase = 'phase1' and v_has_phase2_fields then
        raise exception 'phase 1 only fields allowed' using errcode = 'P0001';
    end if;
    if v_phase = 'phase2_open' and v_has_phase1_fields then
        raise exception 'phase 1 ended; group + advancer picks are frozen'
            using errcode = 'P0001';
    end if;

    if v_prediction_id is null then
        if v_prediction_name is null then
            raise exception 'prediction name required' using errcode = 'P0001';
        end if;
        if v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            insert into public.predictions (
                user_id, tournament_id, prediction_name, total_goals,
                champion_team_id, submitted_at
            )
            values (
                v_user,
                v_tournament_id,
                v_prediction_name,
                v_total_goals,
                v_champion_team_id,
                case when v_mark_submitted then now() else null end
            )
            returning id into v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    else
        perform 1 from public.predictions
            where id = v_prediction_id and user_id = v_user and tournament_id = v_tournament_id;
        if not found then
            raise exception 'prediction not found' using errcode = 'P0001';
        end if;

        if v_has_champion_key and v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            update public.predictions
               set prediction_name = case
                       when v_phase = 'phase1'
                           then coalesce(v_prediction_name, prediction_name)
                       else prediction_name
                   end,
                   total_goals = case when v_phase = 'phase2_open' then v_total_goals else total_goals end,
                   champion_team_id = case
                       when v_phase = 'phase1' and v_has_champion_key then v_champion_team_id
                       else champion_team_id
                   end,
                   submitted_at = case when v_mark_submitted then now() else submitted_at end
             where id = v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    end if;

    if v_phase = 'phase1' then
        delete from public.advancer_predictions where prediction_id = v_prediction_id;
        delete from public.group_predictions where prediction_id = v_prediction_id;

        for v_group in select * from jsonb_array_elements(coalesce(payload->'groups', '[]'::jsonb))
        loop
            v_group_id := v_group->>'group_id';
            v_team_ids := array_remove(array[
                nullif(v_group->>'first', ''),
                nullif(v_group->>'second', ''),
                nullif(v_group->>'third', ''),
                nullif(v_group->>'fourth', '')
            ], null);

            select t.id into v_mismatched_team
              from public.teams t
             where t.id = any(v_team_ids) and t.group_id is distinct from v_group_id
             limit 1;

            if v_mismatched_team is not null then
                raise exception 'team % does not belong to group %', v_mismatched_team, v_group_id
                    using errcode = 'P0001';
            end if;

            insert into public.group_predictions (
                prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id
            ) values (
                v_prediction_id,
                v_group_id,
                nullif(v_group->>'first', ''),
                nullif(v_group->>'second', ''),
                nullif(v_group->>'third', ''),
                nullif(v_group->>'fourth', '')
            );
        end loop;

        select array_agg(third_team_id) into v_valid_thirds
          from public.group_predictions
         where prediction_id = v_prediction_id
           and third_team_id is not null;

        for v_advancer in select * from jsonb_array_elements(coalesce(payload->'advancers', '[]'::jsonb))
        loop
            v_rank := nullif(v_advancer->>'rank', '')::int;
            v_team_id := nullif(v_advancer->>'team_id', '');
            if v_team_id is null then
                continue;
            end if;
            if v_rank is null or v_rank < 1 or v_rank > 8 then
                raise exception 'advancer rank must be 1..8 (got %)', v_rank using errcode = 'P0001';
            end if;
            if v_rank = any(v_seen_ranks) then
                raise exception 'duplicate advancer rank %', v_rank using errcode = 'P0001';
            end if;
            if v_team_id = any(v_seen_teams) then
                raise exception 'duplicate advancer team' using errcode = 'P0001';
            end if;
            if v_valid_thirds is null or not (v_team_id = any(v_valid_thirds)) then
                raise exception 'advancer team % not in your 3rd-place picks', v_team_id
                    using errcode = 'P0001';
            end if;
            v_seen_ranks := array_append(v_seen_ranks, v_rank);
            v_seen_teams := array_append(v_seen_teams, v_team_id);

            insert into public.advancer_predictions (prediction_id, rank, team_id)
            values (v_prediction_id, v_rank, v_team_id);
        end loop;
    elsif v_phase = 'phase2_open' then
        -- Per-fixture lock: delete only UNLOCKED fixtures; a locked fixture's
        -- stored pick is authoritative and survives the rewrite.
        delete from public.knockout_predictions kp
            where kp.prediction_id = v_prediction_id
              and not public.is_knockout_match_locked(v_tournament_id, kp.match_id);
        for v_match in select * from jsonb_array_elements(coalesce(payload->'knockout', '[]'::jsonb))
        loop
            -- Silently ignore incoming changes to a locked fixture (stale clients
            -- are safe). Locked rows were never deleted above, so skipping here
            -- preserves them.
            if public.is_knockout_match_locked(v_tournament_id, v_match->>'match_id') then
                continue;
            end if;
            insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
            values (
                v_prediction_id,
                v_match->>'match_id',
                nullif(v_match->>'winner', '')
            );
        end loop;
    end if;

    return v_prediction_id;
end;
$$;

grant execute on function public.submit_predictions(jsonb) to authenticated;

-- ========== admin_submit_predictions (re-emit from 0050, per-fixture lock guard) ==========
-- Verbatim re-emit of the 0050 body. ONLY the knockout write block changes, the
-- same way as submit_predictions. The per-fixture lock is honored even for
-- super-admin (no v_super bypass here): correcting a locked pick requires an
-- explicit unlock (admin_set_knockout_match_lock(..., null)) first.

create or replace function public.admin_submit_predictions(p_user_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tournament_id uuid := (payload->>'tournament_id')::uuid;
    v_prediction_id uuid := nullif(payload->>'prediction_id', '')::uuid;
    v_prediction_name text := nullif(trim(payload->>'prediction_name'), '');
    v_total_goals int := nullif(payload->>'total_goals', '')::int;
    v_champion_team_id text := nullif(payload->>'champion_team_id', '');
    v_has_champion_key boolean := payload ? 'champion_team_id';
    v_mark_submitted boolean := coalesce((payload->>'submit')::boolean, true);
    v_phase text;
    v_super boolean;
    v_group jsonb;
    v_match jsonb;
    v_advancer jsonb;
    v_rank int;
    v_team_id text;
    v_seen_ranks int[] := '{}';
    v_seen_teams text[] := '{}';
    v_valid_thirds text[];
    v_group_id text;
    v_team_ids text[];
    v_mismatched_team text;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_user_id is null or v_tournament_id is null then
        raise exception 'user_id and tournament_id are required' using errcode = 'P0001';
    end if;

    v_super := public.is_super_admin();
    v_phase := public.tournament_phase(v_tournament_id);

    if not v_super then
        if v_prediction_id is null and v_phase <> 'phase1' then
            raise exception 'phase 1 ended; new predictions cannot be created'
                using errcode = 'P0001';
        end if;
        if v_phase = 'phase1_locked' or v_phase = 'phase2_locked' then
            raise exception 'predictions are locked';
        end if;
    end if;

    if v_prediction_id is null then
        if v_prediction_name is null then
            raise exception 'prediction name required' using errcode = 'P0001';
        end if;
        if v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            insert into public.predictions (
                user_id, tournament_id, prediction_name, total_goals,
                champion_team_id, submitted_at
            )
            values (
                p_user_id,
                v_tournament_id,
                v_prediction_name,
                v_total_goals,
                v_champion_team_id,
                case when v_mark_submitted then now() else null end
            )
            returning id into v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    else
        perform 1 from public.predictions
            where id = v_prediction_id and user_id = p_user_id and tournament_id = v_tournament_id;
        if not found then
            raise exception 'prediction not found' using errcode = 'P0001';
        end if;

        if v_has_champion_key and v_champion_team_id is null then
            raise exception 'champion pick required' using errcode = 'P0001';
        end if;

        begin
            update public.predictions
               set prediction_name = case
                       when v_super or v_phase = 'phase1'
                           then coalesce(v_prediction_name, prediction_name)
                       else prediction_name
                   end,
                   total_goals = v_total_goals,
                   champion_team_id = case
                       when v_has_champion_key and (v_super or v_phase = 'phase1')
                           then v_champion_team_id
                       else champion_team_id
                   end,
                   submitted_at = case when v_mark_submitted then now() else submitted_at end
             where id = v_prediction_id;
        exception
            when unique_violation then
                raise exception 'prediction name taken' using errcode = 'P0001';
        end;
    end if;

    if v_super or v_phase = 'phase1' then
        delete from public.advancer_predictions where prediction_id = v_prediction_id;
        delete from public.group_predictions where prediction_id = v_prediction_id;

        for v_group in select * from jsonb_array_elements(coalesce(payload->'groups', '[]'::jsonb))
        loop
            v_group_id := v_group->>'group_id';
            v_team_ids := array_remove(array[
                nullif(v_group->>'first', ''),
                nullif(v_group->>'second', ''),
                nullif(v_group->>'third', ''),
                nullif(v_group->>'fourth', '')
            ], null);

            select t.id into v_mismatched_team
              from public.teams t
             where t.id = any(v_team_ids) and t.group_id is distinct from v_group_id
             limit 1;

            if v_mismatched_team is not null then
                raise exception 'team % does not belong to group %', v_mismatched_team, v_group_id
                    using errcode = 'P0001';
            end if;

            insert into public.group_predictions (
                prediction_id, group_id, first_team_id, second_team_id, third_team_id, fourth_team_id
            ) values (
                v_prediction_id,
                v_group_id,
                nullif(v_group->>'first', ''),
                nullif(v_group->>'second', ''),
                nullif(v_group->>'third', ''),
                nullif(v_group->>'fourth', '')
            );
        end loop;

        select array_agg(third_team_id) into v_valid_thirds
          from public.group_predictions
         where prediction_id = v_prediction_id
           and third_team_id is not null;

        for v_advancer in select * from jsonb_array_elements(coalesce(payload->'advancers', '[]'::jsonb))
        loop
            v_rank := nullif(v_advancer->>'rank', '')::int;
            v_team_id := nullif(v_advancer->>'team_id', '');
            if v_team_id is null then
                continue;
            end if;
            if v_rank is null or v_rank < 1 or v_rank > 8 then
                raise exception 'advancer rank must be 1..8 (got %)', v_rank using errcode = 'P0001';
            end if;
            if v_rank = any(v_seen_ranks) then
                raise exception 'duplicate advancer rank %', v_rank using errcode = 'P0001';
            end if;
            if v_team_id = any(v_seen_teams) then
                raise exception 'duplicate advancer team' using errcode = 'P0001';
            end if;
            if v_valid_thirds is null or not (v_team_id = any(v_valid_thirds)) then
                raise exception 'advancer team % not in your 3rd-place picks', v_team_id
                    using errcode = 'P0001';
            end if;
            v_seen_ranks := array_append(v_seen_ranks, v_rank);
            v_seen_teams := array_append(v_seen_teams, v_team_id);

            insert into public.advancer_predictions (prediction_id, rank, team_id)
            values (v_prediction_id, v_rank, v_team_id);
        end loop;
    end if;

    if v_super or v_phase = 'phase2_open' then
        -- Per-fixture lock applies uniformly (no super-admin bypass): a locked
        -- fixture's stored pick survives. To change it, unlock the fixture first.
        delete from public.knockout_predictions kp
            where kp.prediction_id = v_prediction_id
              and not public.is_knockout_match_locked(v_tournament_id, kp.match_id);
        for v_match in select * from jsonb_array_elements(coalesce(payload->'knockout', '[]'::jsonb))
        loop
            if public.is_knockout_match_locked(v_tournament_id, v_match->>'match_id') then
                continue;
            end if;
            insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
            values (
                v_prediction_id,
                v_match->>'match_id',
                nullif(v_match->>'winner', '')
            );
        end loop;
    end if;

    return v_prediction_id;
end;
$$;

grant execute on function public.admin_submit_predictions(uuid, jsonb) to authenticated;

-- ========== admin_autofill_locked_fixtures ==========
-- Fills blanks for fixtures that are ALREADY LOCKED (kicked off), reusing the
-- exact outcome-blind winner rule + source resolution from 0071. Unlike
-- admin_autofill_phase2_brackets, this runs DURING phase2_open and touches only
-- locked fixtures, so users keep editing everything not yet kicked off.
--
--   Per locked, still-blank match: resolve the two real teams, then
--     1. champion override, 2. better real group finish, 3. slot-1 tiebreak.
--   It never reads knockout_results, so the pick is a forecast, not a backfill.
--   Does NOT touch predictions.total_goals or .updated_at (those stay the user's
--   to set until the global lock; the 0071 sweep handles them at phase2_locked).

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
    -- ----- guards -----
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

    -- Resolution data must exist or we'd write NULL winners. (Phase 2 can't open
    -- without it, but check defensively — mirrors 0071.)
    if (select count(*) from public.group_standings where tournament_id = p_tournament_id) <> 12 then
        raise exception 'resolution data incomplete';
    end if;

    -- Nothing to do if no fixture is currently locked.
    if not exists (
        select 1 from public.knockout_match_locks
        where tournament_id = p_tournament_id and now() >= locked_at
    ) then
        return jsonb_build_object(
            'predictions_eligible', 0, 'predictions_touched', 0, 'matches_filled', 0
        );
    end if;

    -- ----- per eligible prediction (same eligibility as 0071) -----
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

        -- Seed the working winners map from the user's existing (non-null) picks
        -- so downstream locked fixtures cascade from them and we never overwrite.
        select coalesce(jsonb_object_agg(kp.match_id, kp.winner_team_id), '{}'::jsonb)
            into v_winners
            from public.knockout_predictions kp
            where kp.prediction_id = v_pred.id and kp.winner_team_id is not null;

        for v_match in
            select id, team1_source, team2_source
                from public.knockout_matches
                order by match_order
        loop
            -- Already has a pick (user or filled earlier this run) -> keep it.
            if v_winners ? v_match.id then
                continue;
            end if;
            -- Only fill fixtures that have actually locked (kicked off). Leave
            -- everything still editable for the user to finish.
            if not public.is_knockout_match_locked(p_tournament_id, v_match.id) then
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
