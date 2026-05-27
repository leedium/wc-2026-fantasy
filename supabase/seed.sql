-- WC2026 seed data: groups, teams, knockout bracket metadata, and an active tournament.

insert into public.groups (id, name) values
    ('A', 'Group A'), ('B', 'Group B'), ('C', 'Group C'), ('D', 'Group D'),
    ('E', 'Group E'), ('F', 'Group F'), ('G', 'Group G'), ('H', 'Group H'),
    ('I', 'Group I'), ('J', 'Group J'), ('K', 'Group K'), ('L', 'Group L');

insert into public.teams (id, name, code, group_id) values
    ('mex', 'Mexico', 'MEX', 'A'),
    ('kor', 'South Korea', 'KOR', 'A'),
    ('rsa', 'South Africa', 'RSA', 'A'),
    ('cze', 'Czechia', 'CZE', 'A'),
    ('can', 'Canada', 'CAN', 'B'),
    ('sui', 'Switzerland', 'SUI', 'B'),
    ('qat', 'Qatar', 'QAT', 'B'),
    ('bih', 'Bosnia and Herzegovina', 'BIH', 'B'),
    ('bra', 'Brazil', 'BRA', 'C'),
    ('mar', 'Morocco', 'MAR', 'C'),
    ('sco', 'Scotland', 'SCO', 'C'),
    ('hai', 'Haiti', 'HAI', 'C'),
    ('usa', 'United States', 'USA', 'D'),
    ('par', 'Paraguay', 'PAR', 'D'),
    ('aus', 'Australia', 'AUS', 'D'),
    ('tur', 'Türkiye', 'TUR', 'D'),
    ('ger', 'Germany', 'GER', 'E'),
    ('ecu', 'Ecuador', 'ECU', 'E'),
    ('civ', 'Ivory Coast', 'CIV', 'E'),
    ('cuw', 'Curaçao', 'CUW', 'E'),
    ('ned', 'Netherlands', 'NED', 'F'),
    ('jpn', 'Japan', 'JPN', 'F'),
    ('tun', 'Tunisia', 'TUN', 'F'),
    ('swe', 'Sweden', 'SWE', 'F'),
    ('bel', 'Belgium', 'BEL', 'G'),
    ('irn', 'Iran', 'IRN', 'G'),
    ('egy', 'Egypt', 'EGY', 'G'),
    ('nzl', 'New Zealand', 'NZL', 'G'),
    ('esp', 'Spain', 'ESP', 'H'),
    ('uru', 'Uruguay', 'URU', 'H'),
    ('sau', 'Saudi Arabia', 'KSA', 'H'),
    ('cpv', 'Cape Verde', 'CPV', 'H'),
    ('fra', 'France', 'FRA', 'I'),
    ('sen', 'Senegal', 'SEN', 'I'),
    ('nor', 'Norway', 'NOR', 'I'),
    ('irq', 'Iraq', 'IRQ', 'I'),
    ('arg', 'Argentina', 'ARG', 'J'),
    ('aut', 'Austria', 'AUT', 'J'),
    ('alg', 'Algeria', 'ALG', 'J'),
    ('jor', 'Jordan', 'JOR', 'J'),
    ('por', 'Portugal', 'POR', 'K'),
    ('col', 'Colombia', 'COL', 'K'),
    ('uzb', 'Uzbekistan', 'UZB', 'K'),
    ('cod', 'DR Congo', 'COD', 'K'),
    ('eng', 'England', 'ENG', 'L'),
    ('cro', 'Croatia', 'CRO', 'L'),
    ('pan', 'Panama', 'PAN', 'L'),
    ('gha', 'Ghana', 'GHA', 'L');

insert into public.knockout_matches (id, stage, team1_source, team2_source, point_value, match_order) values
    -- Knockout match ids align with the official FIFA 2026 schedule:
    -- R32 = matches 73-88, R16 = 89-96, QF = 97-100, SF = 101-102,
    -- third place = 103, final = 104. `match_order` is an internal
    -- 1..32 sort weight and remains decoupled from the FIFA id.
    -- The `'3-XXXXX'` source strings are decorative in the v2 model -
    -- admins assign the actual advancer to each 3rd-place slot via
    -- r32_bracket_assignments once FIFA publishes the bracket.
    ('M73', 'round_of_32',  '2A',  '2B',      2,  1),
    ('M74', 'round_of_32',  '1E',  '3-ABCDF', 2,  2),
    ('M75', 'round_of_32',  '1F',  '2C',      2,  3),
    ('M76', 'round_of_32',  '1C',  '2F',      2,  4),
    ('M77', 'round_of_32',  '1I',  '3-CDFGH', 2,  5),
    ('M78', 'round_of_32',  '2E',  '2I',      2,  6),
    ('M79', 'round_of_32',  '1A',  '3-CEFHI', 2,  7),
    ('M80', 'round_of_32',  '1L',  '3-EHIJK', 2,  8),
    ('M81', 'round_of_32',  '1D',  '3-BEFIJ', 2,  9),
    ('M82', 'round_of_32',  '1G',  '3-AEHIJ', 2, 10),
    ('M83', 'round_of_32',  '2K',  '2L',      2, 11),
    ('M84', 'round_of_32',  '1H',  '2J',      2, 12),
    ('M85', 'round_of_32',  '1B',  '3-EFGIJ', 2, 13),
    ('M86', 'round_of_32',  '1J',  '2H',      2, 14),
    ('M87', 'round_of_32',  '1K',  '3-DEIJL', 2, 15),
    ('M88', 'round_of_32',  '2D',  '2G',      2, 16),
    -- R16/QF pairings follow the official FIFA 2026 schedule (verified
    -- against Wikipedia + FIFA.com). Migration 0049 keeps the live DB
    -- in sync with these values; seed is the source of truth for fresh
    -- resets.
    ('M89',  'round_of_16',  'M74', 'M77', 4, 17),
    ('M90',  'round_of_16',  'M73', 'M75', 4, 18),
    ('M91',  'round_of_16',  'M76', 'M78', 4, 19),
    ('M92',  'round_of_16',  'M79', 'M80', 4, 20),
    ('M93',  'round_of_16',  'M83', 'M84', 4, 21),
    ('M94',  'round_of_16',  'M81', 'M82', 4, 22),
    ('M95',  'round_of_16',  'M86', 'M88', 4, 23),
    ('M96',  'round_of_16',  'M85', 'M87', 4, 24),
    ('M97',  'quarter_finals','M89','M90', 8, 25),
    ('M98',  'quarter_finals','M93','M94', 8, 26),
    ('M99',  'quarter_finals','M91','M92', 8, 27),
    ('M100', 'quarter_finals','M95','M96', 8, 28),
    ('M101', 'semi_finals',   'M97','M98',15, 29),
    ('M102', 'semi_finals',   'M99','M100',15, 30),
    ('M103', 'third_place',   'L-M101','L-M102',10,31),
    ('M104', 'final',         'M101','M102',25, 32);

insert into public.tournaments (slug, name, status, lock_time, is_active)
values ('wc2026', 'FIFA World Cup 2026', 'upcoming', now() + interval '30 days', true);

-- =============================================================================
-- Local-only dev accounts
-- =============================================================================
-- Re-seeded on every `supabase db reset` so local super-admin access doesn't
-- get wiped. seed.sql is local-only — never runs against production.
-- Add new accounts by following the same pattern (auth.users + auth.identities
-- + a post-trigger profile flag flip). All inserts are idempotent on the
-- stable UUID, so re-running the seed is safe.
--
-- Account: leedium@me.com / localdev123 (super admin, username `user_4f1fc348`)
-- =============================================================================

insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) values (
    '00000000-0000-0000-0000-000000000000',
    '0b42c609-f4e3-493e-bb06-162aa57318e7',
    'authenticated', 'authenticated',
    'leedium@me.com',
    extensions.crypt('localdev123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"user_4f1fc348"}'::jsonb,
    now(), now(),
    '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
) values (
    extensions.gen_random_uuid(),
    '0b42c609-f4e3-493e-bb06-162aa57318e7',
    '{"sub":"0b42c609-f4e3-493e-bb06-162aa57318e7","email":"leedium@me.com"}'::jsonb,
    'email',
    '0b42c609-f4e3-493e-bb06-162aa57318e7',
    now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- handle_new_user trigger created the profile row above with the username
-- from raw_user_meta_data. Now flip is_admin/is_super_admin — we have to
-- temporarily disable both row-update triggers on profiles:
--   * profiles_block_super_admin_change blocks is_super_admin transitions
--     from app context.
--   * profiles_block_admin_self_elevation raises 'cannot modify is_admin'
--     whenever is_admin changes and the caller isn't already admin. Seed
--     runs as the `postgres` role with no auth.uid(), so is_admin() returns
--     false and the trigger fires — which would roll back the whole seed.
alter table public.profiles disable trigger profiles_block_super_admin_change;
alter table public.profiles disable trigger profiles_block_admin_self_elevation;

update public.profiles
   set is_admin = true,
       is_super_admin = true
 where id = '0b42c609-f4e3-493e-bb06-162aa57318e7';

alter table public.profiles enable trigger profiles_block_admin_self_elevation;
alter table public.profiles enable trigger profiles_block_super_admin_change;
