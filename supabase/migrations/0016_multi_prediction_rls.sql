-- Multi-prediction support — Phase 5: RLS updates and grants for the new
-- payment ownership model.

-- tournament_payments select: ownership is now via the prediction.
drop policy if exists "tournament_payments_select_own_or_admin" on public.tournament_payments;

create policy "tournament_payments_select_own_or_admin"
    on public.tournament_payments for select
    using (
        public.is_admin()
        or exists (
            select 1 from public.predictions pr
            where pr.id = tournament_payments.prediction_id
              and pr.user_id = auth.uid()
        )
    );

-- Allow users to delete their own predictions pre-lock, but not paid ones —
-- the cascade FK on tournament_payments would otherwise erase financial
-- history. Admin must un-mark paid before the user can delete.
create policy "predictions_delete_own_before_lock"
    on public.predictions for delete
    using (
        auth.uid() = user_id
        and public.is_before_lock(tournament_id)
        and not exists (
            select 1 from public.tournament_payments tp
            where tp.prediction_id = predictions.id
        )
    );
