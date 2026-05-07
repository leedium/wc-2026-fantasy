-- Multi-prediction support — Phase 1: additive schema only.
--
-- Adds `prediction_name` (nullable for now) and a unique-by-(user, tournament,
-- name) index. Adds `prediction_id` to `tournament_payments`. Old uniqueness
-- constraints stay until 0014 so the running app keeps working.

alter table public.predictions
    add column prediction_name text;

alter table public.predictions
    add constraint predictions_prediction_name_format check (
        prediction_name is null
        or (length(prediction_name) between 1 and 60
            and prediction_name ~ '^[A-Za-z0-9 _\-\.''‘’]+$')
    );

create unique index predictions_user_tournament_name_idx
    on public.predictions (user_id, tournament_id, lower(prediction_name))
    where prediction_name is not null;

alter table public.tournament_payments
    add column prediction_id uuid references public.predictions(id) on delete cascade;

create index tournament_payments_prediction_idx
    on public.tournament_payments (prediction_id);
