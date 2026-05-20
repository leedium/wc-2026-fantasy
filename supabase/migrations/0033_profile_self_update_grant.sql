-- Same class of fix as 0011 (prediction tables) and 0019 (admin-write
-- reference tables): grant the missing UPDATE privilege on public.profiles
-- to authenticated. Supabase Cloud doesn't extend default INSERT/UPDATE/
-- DELETE privileges to tables created via migrations; without this grant
-- PostgREST returns 403 'permission denied for table profiles' before RLS
-- is consulted, even though the profiles_update_own policy (0002) already
-- allows owners to update their row.
--
-- RLS continues to restrict updates to auth.uid() = id, and the
-- prevent_admin_self_elevation (0002) and prevent_super_admin_change (0010)
-- BEFORE-UPDATE triggers continue to block is_admin / is_super_admin
-- changes from the app context. This migration only widens the privilege
-- bit, not the security model.

grant update on public.profiles to authenticated;
