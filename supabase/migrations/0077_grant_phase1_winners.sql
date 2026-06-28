-- 0077_grant_phase1_winners.sql
--
-- Hotfix (same class as 0075): migration 0070 created public.phase1_winners with
-- a select-all RLS policy but never granted table-level SELECT to the API roles.
-- Local default privileges auto-grant it, so it worked locally; on the remote
-- project the anon/authenticated roles get "permission denied for table
-- phase1_winners", so GET /api/leaderboard/phase1-winners 500s and the Phase 1
-- winners card shows nothing even after a successful admin snapshot (the snapshot
-- RPC is SECURITY DEFINER, so it writes fine — only the read is blocked).
--
-- The data is non-sensitive (usernames + points, top 3), already exposed by the
-- phase1_winners_select_all policy. Grant matches the read-all-table convention.

grant select on public.phase1_winners to anon, authenticated;
