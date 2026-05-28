-- 0053_restore_third_place_scoring.sql
--
-- Reverses 0051's zeroing of the third-place (M103) bonus. The product
-- decision is to bring back the third-place playoff as a required,
-- scored knockout round worth +5 (its v3 value).
--
-- The third_place_score CTE in get_leaderboard / get_leaderboard_rank
-- (0051) is still wired up — it joins knockout_predictions /
-- knockout_results on match_id = 'M103' and multiplies a correct pick by
-- scoring_third_place_pts(). So a single create-or-replace restores the
-- +5 award with no need to re-emit the leaderboard RPCs.

create or replace function public.scoring_third_place_pts()
returns int
language sql
immutable
parallel safe
set search_path = public
as $$ select 5 $$;
