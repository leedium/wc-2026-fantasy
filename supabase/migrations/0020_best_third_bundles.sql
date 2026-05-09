-- Best-3rd-of-bundle scaffolding.
--
-- The 2026 FIFA World Cup R32 sources 24 of its 32 teams from group
-- winners + runners-up, and the remaining 8 from the **best 8 of 12
-- third-placed teams**. Each of those 8 R32 slots is pre-bound to a
-- 5-group bundle (e.g. "Best 3rd of A/B/C/D/F").
--
-- This migration:
--   1. Adds three tables: `third_place_bundles` (the 8 reference rows),
--      `third_place_bundle_predictions` (per-prediction picks), and
--      `tournament_third_place_advancers` (admin-populated, the team
--      that actually advanced for each slot).
--   2. Re-sources the 16 R32 matches (M1..M16) per FIFA's published
--      bracket so that 8 of them carry a `'3-{LETTERS}'` source instead
--      of the old `'3A'`/`'3B'`/`'3C'`/`'3D'` placeholders.
--   3. Drops the obsolete unique check on group_predictions that
--      (incidentally) is unaffected here — but flagged so future cleanup
--      knows.
--
-- The phase-2 lock + admin advancers UI follow in a separate PR. With
-- only this migration, bundle picks drive the R32 sources directly via
-- the resolver (user's bundle pick → user's group-prediction 3rd-place
-- team).

-- ========== reference table: third_place_bundles ==========

create table public.third_place_bundles (
    slot_index int primary key check (slot_index between 0 and 7),
    allowed_letters text[] not null
        check (cardinality(allowed_letters) = 5),
    -- Stored as plain text rather than an FK because seed.sql populates
    -- knockout_matches AFTER migrations finish. The integrity is enforced
    -- in code (the resolver looks up by r32_match_id; broken refs render
    -- as TBD).
    r32_match_id text not null,
    bundle_key text not null unique
);

insert into public.third_place_bundles (slot_index, allowed_letters, r32_match_id, bundle_key) values
    (0, array['A','B','C','D','F'], 'M2',  'ABCDF'),
    (1, array['C','D','F','G','H'], 'M5',  'CDFGH'),
    (2, array['C','E','F','H','I'], 'M7',  'CEFHI'),
    (3, array['E','H','I','J','K'], 'M8',  'EHIJK'),
    (4, array['B','E','F','I','J'], 'M9',  'BEFIJ'),
    (5, array['A','E','H','I','J'], 'M10', 'AEHIJ'),
    (6, array['E','F','G','I','J'], 'M13', 'EFGIJ'),
    (7, array['D','E','I','J','L'], 'M15', 'DEIJL');

alter table public.third_place_bundles enable row level security;
create policy "third_place_bundles_select_all"
    on public.third_place_bundles for select
    using (true);

grant select on public.third_place_bundles to anon, authenticated;

-- ========== per-prediction bundle picks ==========
-- One row per (prediction, bundle slot). group_letter is one of the
-- 5 letters in the slot's allowed_letters; enforced by the RPC.

create table public.third_place_bundle_predictions (
    prediction_id uuid not null references public.predictions(id) on delete cascade,
    slot_index int not null references public.third_place_bundles(slot_index),
    group_letter text not null references public.groups(id),
    primary key (prediction_id, slot_index)
);

create index third_place_bundle_predictions_prediction_idx
    on public.third_place_bundle_predictions (prediction_id);

alter table public.third_place_bundle_predictions enable row level security;

create policy "third_place_bundle_predictions_select_own_or_admin"
    on public.third_place_bundle_predictions for select
    using (
        public.is_admin()
        or exists (
            select 1 from public.predictions p
            where p.id = third_place_bundle_predictions.prediction_id
              and p.user_id = auth.uid()
        )
    );

-- Writes only via the submit_predictions RPC (which does the validation).
-- Block direct inserts from the authenticated role.
create policy "third_place_bundle_predictions_no_direct_write"
    on public.third_place_bundle_predictions for all
    using (public.is_admin())
    with check (public.is_admin());

grant select on public.third_place_bundle_predictions to authenticated;

-- ========== admin-populated advancers ==========
-- Filled in once group standings are known. Used by the resolver post-
-- group-stage so the bracket shows real teams instead of bundle picks.

create table public.tournament_third_place_advancers (
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    slot_index int not null references public.third_place_bundles(slot_index),
    group_letter text not null references public.groups(id),
    primary key (tournament_id, slot_index)
);

alter table public.tournament_third_place_advancers enable row level security;

create policy "advancers_select_all"
    on public.tournament_third_place_advancers for select
    using (true);

create policy "advancers_admin_write"
    on public.tournament_third_place_advancers for all
    using (public.is_admin())
    with check (public.is_admin());

grant select on public.tournament_third_place_advancers to anon, authenticated;
grant insert, update, delete on public.tournament_third_place_advancers to authenticated;

-- The R32 layout (M1..M16) is also seeded with the FIFA bundle pattern in
-- supabase/seed.sql for fresh local resets. seed.sql doesn't run on prod
-- though, so existing prod rows must be UPDATED explicitly here. The
-- UPDATEs are idempotent — setting the same values when re-run is a no-op.
-- R16 onwards (M17..M32) is unchanged.

update public.knockout_matches set team1_source = '2A', team2_source = '2B'      where id = 'M1';
update public.knockout_matches set team1_source = '1E', team2_source = '3-ABCDF' where id = 'M2';
update public.knockout_matches set team1_source = '1F', team2_source = '2C'      where id = 'M3';
update public.knockout_matches set team1_source = '1C', team2_source = '2F'      where id = 'M4';
update public.knockout_matches set team1_source = '1I', team2_source = '3-CDFGH' where id = 'M5';
update public.knockout_matches set team1_source = '2E', team2_source = '2I'      where id = 'M6';
update public.knockout_matches set team1_source = '1A', team2_source = '3-CEFHI' where id = 'M7';
update public.knockout_matches set team1_source = '1L', team2_source = '3-EHIJK' where id = 'M8';
update public.knockout_matches set team1_source = '1D', team2_source = '3-BEFIJ' where id = 'M9';
update public.knockout_matches set team1_source = '1G', team2_source = '3-AEHIJ' where id = 'M10';
update public.knockout_matches set team1_source = '2K', team2_source = '2L'      where id = 'M11';
update public.knockout_matches set team1_source = '1H', team2_source = '2J'      where id = 'M12';
update public.knockout_matches set team1_source = '1B', team2_source = '3-EFGIJ' where id = 'M13';
update public.knockout_matches set team1_source = '1J', team2_source = '2H'      where id = 'M14';
update public.knockout_matches set team1_source = '1K', team2_source = '3-DEIJL' where id = 'M15';
update public.knockout_matches set team1_source = '2D', team2_source = '2G'      where id = 'M16';
