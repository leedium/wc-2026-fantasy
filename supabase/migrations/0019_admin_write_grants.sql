-- Same class of fix as 0011 (which granted writes on prediction tables) for
-- the admin-write reference tables. Supabase Cloud doesn't extend default
-- INSERT/UPDATE/DELETE privileges to tables created via migrations; without
-- explicit grants, PostgREST returns 403 'permission denied for table X'
-- before RLS is consulted. RLS already restricts writes to is_admin() so
-- this only widens the privilege bit, not the security model.

grant insert, update, delete on
    public.tournaments,
    public.group_standings,
    public.knockout_results
  to authenticated;
