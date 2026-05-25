-- 0041_tournament_pot_stats.sql
--
-- Public aggregate counts for the home-page Pot Total + Total Entries
-- displays. `tournament_payments` has an `own_or_admin` SELECT policy
-- (see 0016_multi_prediction_rls.sql), so a logged-out visitor counting
-- rows through the anon client sees 0 — which is why the production
-- home page was stuck at $0 / 0 entries.
--
-- This RPC mirrors get_leaderboard's SECURITY DEFINER pattern: it
-- bypasses RLS for the count, but returns only two aggregates (no
-- per-user data) so it's safe to grant to anon + authenticated.
--
-- Eligibility predicate matches the route handler it replaces
-- (frontend/src/app/api/tournament/route.ts) and get_leaderboard
-- (0036_champion_pick.sql): `paid_at <= tournaments.lock_time`.

create or replace function public.get_tournament_pot_stats(p_tournament_id uuid)
returns table (
    total_entries int,
    cash_paid_count int
)
language sql
security definer
stable
set search_path = public
as $$
    select
        count(*)::int as total_entries,
        count(*) filter (where tp.is_free = false)::int as cash_paid_count
    from public.tournament_payments tp
    join public.predictions p on p.id = tp.prediction_id
    join public.tournaments t on t.id = p.tournament_id
    where p.tournament_id = p_tournament_id
      and tp.paid_at <= t.lock_time;
$$;

grant execute on function public.get_tournament_pot_stats(uuid) to anon, authenticated;
