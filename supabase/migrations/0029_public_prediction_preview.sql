-- Public bracket preview for paid + submitted leaderboard entries.
--
-- The `predictions` SELECT policy is "own_or_admin", so a normal user
-- can't read another user's bracket directly. The leaderboard already
-- exposes who's playing and their points, and the product wants
-- authenticated users to be able to preview each other's paid brackets.
-- Drafts and unpaid predictions remain private.
--
-- This RPC is SECURITY DEFINER so it bypasses RLS, and applies the same
-- eligibility filter the leaderboard already uses:
--   * the caller is authenticated
--   * the prediction is submitted
--   * the prediction has a tournament_payments row with
--     paid_at <= tournament.lock_time
-- Anything else returns no rows (the route maps that to 404).

create or replace function public.get_public_prediction(p_prediction_id uuid)
returns table (
    prediction_id uuid,
    prediction_name text,
    username text,
    total_goals int,
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
        select p.id, p.user_id, p.tournament_id, p.prediction_name, p.total_goals, p.submitted_at
        from public.predictions p
        join public.tournament_payments tp on tp.prediction_id = p.id
        join public.tournaments t on t.id = p.tournament_id
        where p.id = p_prediction_id
          and auth.uid() is not null
          and p.submitted_at is not null
          and tp.paid_at <= t.lock_time
    )
    select
        e.id as prediction_id,
        e.prediction_name::text,
        pr.username::text as username,
        e.total_goals,
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
