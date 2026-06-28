-- 0075_grant_knockout_match_locks.sql
--
-- Hotfix for a production 500 on GET /api/tournament:
--   {"error":"permission denied for table knockout_match_locks"}
--
-- Migration 0072 created public.knockout_match_locks with RLS + a select-all
-- policy but never granted table-level SELECT to the API roles. Local default
-- privileges auto-granted it (so it worked locally), but on the remote project
-- the anon role had no privilege and every public /api/tournament read failed.
-- The project convention is an explicit grant per read-all table (e.g.
-- r32_bracket_assignments); this restores that. The lock times are non-sensitive
-- (select-all policy), so anon + authenticated both get SELECT; writes still go
-- only through the admin SECURITY DEFINER RPC.

grant select on public.knockout_match_locks to anon, authenticated;
