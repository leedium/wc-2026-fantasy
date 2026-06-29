-- 0079_admin_knockout_lock_bypass.sql
--
-- Admin override for locked (kicked-off) knockout fixtures + audit log.
--
-- Background: a bug left a user unable to submit their Round of 32 before those
-- fixtures kicked off. Once a fixture kicks off it is per-fixture locked
-- (knockout_match_locks) and 0072 honored that lock UNIFORMLY — even for super
-- admin via admin_submit_predictions. With no winner recorded on the now-locked
-- R32 matches, the downstream R16 slots never resolve, so the bracket can't be
-- completed and the user is stranded.
--
-- Fix: admin_submit_predictions is already admin-only (is_admin() gate). Relax
-- it so ANY admin, correcting a prediction through the admin editor, can:
--   * save edits to an existing prediction in a locked phase (drop the
--     phase1_locked / phase2_locked write block), and
--   * overwrite knockout picks regardless of per-fixture locks.
-- The regular-user RPC submit_predictions is left untouched — locks still apply
-- to users.
--
-- Accountability: every knockout pick an admin changes once the tournament has
-- begun (tournament_phase <> 'phase1') is recorded in admin_knockout_audit with
-- the acting admin (id + email), the prediction owner (id + email), the match +
-- stage, old/new winner, the phase at write time, and a timestamp.

-- ========== table: admin_knockout_audit ==========
create table if not exists public.admin_knockout_audit (
    id             bigint generated always as identity primary key,
    acted_by       uuid not null references auth.users(id),   -- the admin
    acted_by_email text not null,                             -- admin email snapshot
    user_id        uuid not null references auth.users(id),   -- prediction owner
    user_email     text not null,                             -- owner email snapshot
    prediction_id  uuid not null,
    tournament_id  uuid not null,
    match_id       text not null references public.knockout_matches(id),
    stage          text not null,                             -- knockout_matches.stage
    old_winner     text,                                      -- prior pick (nullable)
    new_winner     text,                                      -- new pick (nullable)
    phase          text not null,                             -- tournament_phase at write
    created_at     timestamptz not null default now()
);

create index if not exists admin_knockout_audit_user_idx
    on public.admin_knockout_audit (user_id, created_at desc);
create index if not exists admin_knockout_audit_acted_by_idx
    on public.admin_knockout_audit (acted_by, created_at desc);

alter table public.admin_knockout_audit enable row level security;

-- Admins may read the audit trail; no client INSERT/UPDATE/DELETE — rows are
-- written only by the SECURITY DEFINER admin_submit_predictions RPC.
drop policy if exists admin_knockout_audit_select_admin on public.admin_knockout_audit;
create policy admin_knockout_audit_select_admin on public.admin_knockout_audit
    for select using (public.is_admin());

-- ========== admin_submit_predictions (lock bypass + audit) ==========
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

    -- New predictions still cannot be created once Phase 1 has ended (super
    -- admin excepted). NOTE: unlike 0072 there is no longer a hard
    -- 'predictions are locked' block here — an admin correcting an EXISTING
    -- prediction may save in any phase, including phase1_locked / phase2_locked.
    if not v_super then
        if v_prediction_id is null and v_phase <> 'phase1' then
            raise exception 'phase 1 ended; new predictions cannot be created'
                using errcode = 'P0001';
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

    -- Knockout: any admin may rewrite picks, INCLUDING per-fixture-locked
    -- (kicked-off) matches — this is the override that unblocks bracket
    -- progression. Guarded on the key's presence so a phase-1-only save does not
    -- wipe knockout picks.
    if payload ? 'knockout' then
        -- Audit pass (before the rewrite, so old winners are still present).
        -- Only log once the tournament has begun: a phase-1 edit is normal
        -- pre-lock activity, not an after-the-fact override.
        if v_phase <> 'phase1' then
            for v_match in select * from jsonb_array_elements(payload->'knockout')
            loop
                v_match_id := v_match->>'match_id';
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
    end if;

    return v_prediction_id;
end;
$$;

grant execute on function public.admin_submit_predictions(uuid, jsonb) to authenticated;
