-- 0080_super_admin_only_lock_override.sql
--
-- Restrict post-lock / locked-fixture knockout editing to SUPER ADMINS only.
--
-- 0079 let ANY admin (is_admin) edit knockout picks after lock, including
-- kicked-off (per-fixture-locked) fixtures. The decision changed: that override
-- is a super-admin-only capability. Normal admins revert to their pre-0079
-- behavior:
--   * they may still edit predictions in open phases (phase1 / phase2_open,
--     unlocked fixtures only), but
--   * get 'predictions are locked' once a phase locks, and
--   * can never overwrite a kicked-off (per-fixture-locked) fixture.
-- Super admins keep the full override (edit in any phase, overwrite locked
-- fixtures). The admin_knockout_audit table + rows are unchanged; no data is
-- touched. submit_predictions (regular users) is untouched.

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
    v_acted_by_email text;
    v_user_email text;
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
    v_match_id text;
    v_old_winner text;
    v_new_winner text;
    v_stage text;
begin
    if not public.is_admin() then
        raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if p_user_id is null or v_tournament_id is null then
        raise exception 'user_id and tournament_id are required' using errcode = 'P0001';
    end if;

    v_super := public.is_super_admin();
    v_phase := public.tournament_phase(v_tournament_id);

    -- Email snapshots for the audit trail (RPC is SECURITY DEFINER, so it may
    -- read auth.users). Resolved once; reused per logged match below.
    select email into v_acted_by_email from auth.users where id = auth.uid();
    select email into v_user_email from auth.users where id = p_user_id;

    -- Normal admins: cannot create after Phase 1, and cannot save ANY edit once
    -- a phase has locked (the post-lock override is super-admin-only). Super
    -- admin bypasses both.
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

    -- Knockout writes are allowed for a super admin in any phase, or for any
    -- admin while Phase 2 is open. SUPER ADMIN overwrites every incoming match
    -- (including kicked-off / per-fixture-locked fixtures). A NON-super admin
    -- preserves locked fixtures: only unlocked picks are deleted, and incoming
    -- changes to a locked fixture are skipped. Guarded on the key's presence so
    -- a phase-1-only save does not wipe knockout picks.
    if (v_super or v_phase = 'phase2_open') and (payload ? 'knockout') then
        -- Audit pass (before the rewrite, so old winners are still present).
        -- Log only actual changes once the tournament has begun. A non-super
        -- caller cannot change a locked fixture, so it is skipped here too.
        if v_phase <> 'phase1' then
            for v_match in select * from jsonb_array_elements(payload->'knockout')
            loop
                v_match_id := v_match->>'match_id';
                if not v_super and public.is_knockout_match_locked(v_tournament_id, v_match_id) then
                    continue;
                end if;
                v_new_winner := nullif(v_match->>'winner', '');
                select winner_team_id into v_old_winner
                  from public.knockout_predictions
                 where prediction_id = v_prediction_id and match_id = v_match_id;
                if v_old_winner is distinct from v_new_winner then
                    select stage into v_stage from public.knockout_matches where id = v_match_id;
                    insert into public.admin_knockout_audit (
                        acted_by, acted_by_email, user_id, user_email,
                        prediction_id, tournament_id, match_id, stage,
                        old_winner, new_winner, phase
                    ) values (
                        auth.uid(), v_acted_by_email, p_user_id, v_user_email,
                        v_prediction_id, v_tournament_id, v_match_id, v_stage,
                        v_old_winner, v_new_winner, v_phase
                    );
                end if;
            end loop;
        end if;

        if v_super then
            delete from public.knockout_predictions where prediction_id = v_prediction_id;
            for v_match in select * from jsonb_array_elements(payload->'knockout')
            loop
                insert into public.knockout_predictions (prediction_id, match_id, winner_team_id)
                values (
                    v_prediction_id,
                    v_match->>'match_id',
                    nullif(v_match->>'winner', '')
                );
            end loop;
        else
            -- Per-fixture lock applies to non-super admins: a locked fixture's
            -- stored pick survives and incoming changes to it are ignored.
            delete from public.knockout_predictions kp
                where kp.prediction_id = v_prediction_id
                  and not public.is_knockout_match_locked(v_tournament_id, kp.match_id);
            for v_match in select * from jsonb_array_elements(payload->'knockout')
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
    end if;

    return v_prediction_id;
end;
$$;

grant execute on function public.admin_submit_predictions(uuid, jsonb) to authenticated;
