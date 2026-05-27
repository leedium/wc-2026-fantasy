-- 0049_fifa_official_pairings.sql
--
-- Aligns the knockout bracket pairings with the official FIFA 2026
-- schedule. After Step 1 (migration 0048) the match ids matched FIFA
-- (M73..M104) but the `team1_source` / `team2_source` pointers still
-- reflected the previous internal layout. This migration rewrites
-- those pointers for the 9 rows where FIFA disagrees with our seed.
--
-- FIFA-official pairings (cross-checked against Wikipedia + FIFA.com):
--
--   R16  M89:  M74 vs M77    (was M73 vs M74)
--   R16  M90:  M73 vs M75    (was M75 vs M76)
--   R16  M91:  M76 vs M78    (was M77 vs M78)
--   R16  M92:  M79 vs M80    -- unchanged
--   R16  M93:  M83 vs M84    (was M81 vs M82)
--   R16  M94:  M81 vs M82    (was M83 vs M84)
--   R16  M95:  M86 vs M88    (was M85 vs M86)
--   R16  M96:  M85 vs M87    (was M87 vs M88)
--   QF   M97:  M89 vs M90    -- unchanged
--   QF   M98:  M93 vs M94    (was M91 vs M92)
--   QF   M99:  M91 vs M92    (was M93 vs M94)
--   QF   M100: M95 vs M96    -- unchanged
--   SF   M101: M97 vs M98    -- unchanged
--   SF   M102: M99 vs M100   -- unchanged
--   3rd  M103: L-M101 vs L-M102 -- unchanged
--   Final M104: M101 vs M102 -- unchanged
--
-- Side effect: deletes every `knockout_predictions` row for M89..M104.
-- This is intentional. After the pointer rewrite, any user picks made
-- under the old pairings may name teams that no longer contest the
-- match (e.g. a user picking 'Mexico' to win M89 when M89 is now
-- (M74 winner) vs (M77 winner) and Mexico would come out of M73).
-- Wiping uniformly is simpler and safer than per-row staleness checks
-- and matches the user-confirmed UX of "clean slate for R16".
--
-- Match ids themselves do not change. group_predictions,
-- advancer_predictions, and predictions.champion_team_id are untouched.

do $$
begin
    -- Idempotency guard: M89 already FIFA-aligned -> skip.
    if (select team1_source from public.knockout_matches where id = 'M89') = 'M74' then
        raise notice '0049: pairings already FIFA-aligned, skipping';
        return;
    end if;

    -- R16: 7 of the 8 matches change pointers.
    update public.knockout_matches set team1_source = 'M74', team2_source = 'M77' where id = 'M89';
    update public.knockout_matches set team1_source = 'M73', team2_source = 'M75' where id = 'M90';
    update public.knockout_matches set team1_source = 'M76', team2_source = 'M78' where id = 'M91';
    -- M92 (M79 vs M80) unchanged.
    update public.knockout_matches set team1_source = 'M83', team2_source = 'M84' where id = 'M93';
    update public.knockout_matches set team1_source = 'M81', team2_source = 'M82' where id = 'M94';
    update public.knockout_matches set team1_source = 'M86', team2_source = 'M88' where id = 'M95';
    update public.knockout_matches set team1_source = 'M85', team2_source = 'M87' where id = 'M96';

    -- QF: M98 and M99 swap; M97 and M100 unchanged.
    update public.knockout_matches set team1_source = 'M93', team2_source = 'M94' where id = 'M98';
    update public.knockout_matches set team1_source = 'M91', team2_source = 'M92' where id = 'M99';

    -- SF / 3rd / Final pointers already FIFA-correct, no updates needed.

    -- Wipe stale knockout picks for the rewritten rounds.
    delete from public.knockout_predictions
     where match_id in (
        'M89','M90','M91','M92','M93','M94','M95','M96',
        'M97','M98','M99','M100',
        'M101','M102','M103','M104'
     );
end $$;
