-- Fix advancer_predictions RLS so the user-side submit path actually works.
--
-- Bug: migration 0025 added the table with a single write policy that only
-- allowed admins:
--
--   create policy "advancer_predictions_no_direct_write"
--       on public.advancer_predictions for all
--       using (public.is_admin())
--       with check (public.is_admin());
--
-- The intent was "only the RPC can write, never direct REST", but the
-- assumption was wrong — submit_predictions is SECURITY INVOKER, so when a
-- regular user calls it, the INSERT runs as that user and is checked
-- against the table's RLS. The admin-only WITH CHECK rejects every save
-- and surfaces as "new row violates row-level security policy for table
-- advancer_predictions" / "request failed" in the wizard.
--
-- group_predictions (0002) handles the same pattern correctly: a single
-- "write_own_before_lock" policy that lets users INSERT/UPDATE/DELETE rows
-- whose owning prediction belongs to them and whose tournament is still
-- before lock_time. Mirror that exactly. admin_submit_predictions is
-- SECURITY DEFINER and bypasses RLS, so super-admin god-mode writes still
-- work in phase 2 / past lock without an extra admin policy.

drop policy if exists "advancer_predictions_no_direct_write" on public.advancer_predictions;

create policy "advancer_predictions_write_own_before_lock"
    on public.advancer_predictions for all
    using (
        public.is_admin()
        or exists (
            select 1 from public.predictions p
            where p.id = advancer_predictions.prediction_id
              and p.user_id = auth.uid()
              and public.is_before_lock(p.tournament_id)
        )
    )
    with check (
        public.is_admin()
        or exists (
            select 1 from public.predictions p
            where p.id = advancer_predictions.prediction_id
              and p.user_id = auth.uid()
              and public.is_before_lock(p.tournament_id)
        )
    );

-- The authenticated role needs insert/update/delete grants too (not just
-- SELECT). 0025 only granted SELECT. group_predictions gets the broader
-- grant via 0011_prediction_writes_grants.
grant insert, update, delete on public.advancer_predictions to authenticated;
