-- Multi-prediction support — Phase 3: drop the legacy uniqueness keys.
--
-- After this migration runs, the old code paths break (submit_predictions
-- still does ON CONFLICT (user_id, tournament_id) which no longer exists).
-- 0015 must be applied in the same release.

alter table public.predictions
    drop constraint predictions_user_id_tournament_id_key;

alter table public.tournament_payments
    drop constraint tournament_payments_user_id_tournament_id_key;

alter table public.tournament_payments
    add constraint tournament_payments_prediction_id_key unique (prediction_id);
