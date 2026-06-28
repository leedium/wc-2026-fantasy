-- 0078_preview_phase1_during_phase2_open.sql
--
-- Let other members preview an entry's Phase 1 (group-stage + best-3rd) picks
-- during phase2_open, while keeping its still-editable Phase 2 picks (knockout
-- bracket + tiebreaker total_goals) sealed until the knockout bracket locks.
--
-- 0058 blocked other members' previews ENTIRELY during phase2_open to avoid
-- leaking editable knockout picks. But the group-stage picks are already frozen
-- (phase1_locked precedes phase2_open), so they are safe to reveal. This re-emits
-- 0058's get_public_prediction with two changes:
--   1. the eligibility window adds 'phase2_open', so other members' rows are
--      returned (previously a 404); and
--   2. field-level redaction — total_goals and the knockout array are withheld
--      (null / '[]') from non-owner, non-admin viewers until 'phase2_locked'.
--      The Phase 1 fields (groups, advancers, champion_team_id) are frozen by
--      phase1_locked, so they are always returned to an eligible viewer.
--
-- The owner and admins/super-admins always see everything (the `see_phase2`
-- predicate), at every phase. Otherwise verbatim re-emit of the 0058 body.

create or replace function public.get_public_prediction(p_prediction_id uuid)
returns table (
    prediction_id uuid,
    prediction_name text,
    username text,
    total_goals int,
    champion_team_id text,
    submitted_at timestamptz,
    groups jsonb,
    knockout jsonb,
    advancers jsonb
)
language sql
security definer
stable
set search_path = public
as $$
    with elig as (
        select p.id, p.user_id, p.tournament_id, p.prediction_name, p.total_goals,
               p.champion_team_id, p.submitted_at,
               -- Phase 2 picks (knockout + tiebreaker) are revealed only to the
               -- owner, admins, or once everything is frozen at phase2_locked.
               (p.user_id = auth.uid()
                or public.is_admin()
                or public.is_super_admin()
                or public.tournament_phase(p.tournament_id) = 'phase2_locked') as see_phase2
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        join public.tournaments t on t.id = p.tournament_id
        where p.id = p_prediction_id
          and auth.uid() is not null
          and (p.submitted_at is not null or public.prediction_phase1_complete(p.id))
          and tp.paid_at <= t.lock_time
          and (
              p.user_id = auth.uid()
              or public.is_admin()
              or public.is_super_admin()
              -- Phase 1 picks are frozen by phase1_locked, so other members may
              -- preview from phase1_locked onward — including phase2_open, where
              -- the Phase 2 fields below are redacted. Still excludes 'phase1'
              -- (group picks editable).
              or public.tournament_phase(p.tournament_id) in ('phase1_locked', 'phase2_open', 'phase2_locked')
          )
    )
    select
        e.id as prediction_id,
        e.prediction_name::text,
        pr.username::text as username,
        case when e.see_phase2 then e.total_goals else null end as total_goals,
        e.champion_team_id,
        e.submitted_at,
        coalesce(
            (select jsonb_agg(jsonb_build_object(
                'group_id', gp.group_id,
                'first_team_id', gp.first_team_id,
                'second_team_id', gp.second_team_id,
                'third_team_id', gp.third_team_id,
                'fourth_team_id', gp.fourth_team_id
            ) order by gp.group_id)
            from public.group_predictions gp
            where gp.prediction_id = e.id),
            '[]'::jsonb
        ) as groups,
        case
            when e.see_phase2 then coalesce(
                (select jsonb_agg(jsonb_build_object(
                    'match_id', kp.match_id,
                    'winner_team_id', kp.winner_team_id
                ) order by kp.match_id)
                from public.knockout_predictions kp
                where kp.prediction_id = e.id),
                '[]'::jsonb
            )
            else '[]'::jsonb
        end as knockout,
        coalesce(
            (select jsonb_agg(jsonb_build_object(
                'rank', ap.rank,
                'team_id', ap.team_id
            ) order by ap.rank)
            from public.advancer_predictions ap
            where ap.prediction_id = e.id),
            '[]'::jsonb
        ) as advancers
    from elig e
    join public.profiles pr on pr.id = e.user_id;
$$;

grant execute on function public.get_public_prediction(uuid) to authenticated;
