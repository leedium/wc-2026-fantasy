-- Cloud Supabase projects do not always extend default schema privileges to
-- tables created via migrations, so PostgREST returns 401 (permission denied)
-- before RLS is ever consulted. Grant SELECT explicitly; RLS continues to
-- enforce row-level scope on user-owned tables.

grant select on
    public.groups,
    public.teams,
    public.knockout_matches,
    public.tournaments,
    public.group_standings,
    public.knockout_results,
    public.profiles
  to anon, authenticated;

grant select on
    public.predictions,
    public.group_predictions,
    public.knockout_predictions
  to authenticated;
