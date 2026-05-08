-- Multi-prediction support — Phase 2: backfill data, then enforce NOT NULL.
--
-- Existing predictions get prediction_name = profiles.username so the
-- leaderboard display is identical pre/post migration. Existing payment rows
-- get re-attached to the user's single existing prediction (today's invariant
-- guarantees at most one per (user, tournament)). Aborts if any payment row
-- can't be matched — those orphans must be resolved manually before re-run.

update public.predictions p
   set prediction_name = pr.username::text
  from public.profiles pr
 where p.user_id = pr.id and p.prediction_name is null;

alter table public.predictions
    alter column prediction_name set not null;

update public.tournament_payments tp
   set prediction_id = p.id
  from public.predictions p
 where tp.prediction_id is null
   and p.user_id = tp.user_id
   and p.tournament_id = tp.tournament_id;

do $$
declare
    orphan_count int;
begin
    select count(*) into orphan_count
      from public.tournament_payments
     where prediction_id is null;
    if orphan_count > 0 then
        raise exception 'backfill failed: % orphan tournament_payments rows (no matching prediction)', orphan_count;
    end if;
end $$;

alter table public.tournament_payments
    alter column prediction_id set not null;
