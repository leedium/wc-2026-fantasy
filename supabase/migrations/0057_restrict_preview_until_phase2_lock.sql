-- Restrict previewing OTHER members' brackets until Phase 2 locks.
--
-- The leaderboard's Preview affordance fetches a bracket via the
-- `get_public_prediction` RPC. Until knockout picks are frozen
-- (`tournament_phase = 'phase2_locked'`) a non-admin should only be able to
-- preview their OWN entries; otherwise a player could copy a stronger entry's
-- still-editable picks verbatim. The UI fades+disables the button, but the
-- dialog hits an API route, so the real guard lives here at the RPC (the
-- trust boundary — "don't trust the client").
--
-- This re-emits the 0036 body verbatim and adds a single visibility predicate
-- to the `elig` CTE:
--   * the caller owns the prediction, OR
--   * the caller is an admin or super-admin, OR
--   * the tournament is already in `phase2_locked`.
-- Admins/super-admins (is_admin does NOT imply is_super_admin, so both are
-- checked) retain full preview access at all times. Rows that fail the
-- predicate return nothing, which the route maps to 404.

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
               p.champion_team_id, p.submitted_at
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
              or public.tournament_phase(p.tournament_id) = 'phase2_locked'
          )
    )
    select
        e.id as prediction_id,
        e.prediction_name::text,
        pr.username::text as username,
        e.total_goals,
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
        coalesce(
            (select jsonb_agg(jsonb_build_object(
                'match_id', kp.match_id,
                'winner_team_id', kp.winner_team_id
            ) order by kp.match_id)
            from public.knockout_predictions kp
            where kp.prediction_id = e.id),
            '[]'::jsonb
        ) as knockout,
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
