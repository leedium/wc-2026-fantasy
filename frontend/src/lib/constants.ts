/**
 * Application constants for WC2026 Prediction Game
 */

export const TOURNAMENT_CONFIG = {
  totalTeams: 48,
  totalGroups: 12,
  teamsPerGroup: 4,
  totalMatches: 104,
} as const;

// Group stage: 11 standard groups × 6 (exact-order top-2) + Group I "Group of Death" exact-order = 8.
// Advancers: 8 ranked 3rd-place picks × 1.25 (set + rank) = 10 max.
// Knockout: per-team correct-side maxes — R16 16×5 + QF 8×6 + SF 4×8 + Final 2×10 = 180 — plus
// flat bonuses (champion 15, 3rd-place winner 5) = 200.
// Phase 1 Champions Pick: +5 if `predictions.champion_team_id` matches the actual M32 winner
// (independent of the bracket Final pick).
export const SCORING = {
  maxGroupPoints: 74,
  maxAdvancerPoints: 10,
  maxKnockoutPoints: 200,
  championPickBonus: 5,
  maxTotalPoints: 289,
} as const;

/**
 * Per-prediction entry cost. Paid out-of-band (cash / e-transfer / etc.);
 * an admin marks each prediction as paid in `tournament_payments` before
 * lock so it's eligible for the leaderboard. `charityPortionCAD` is the
 * portion of each entry set aside for a charity (selected by the pool
 * organizer before lock). Surfaced in the home hero (HomePageContent)
 * and the rules page so users see the price and the charity split up
 * front.
 */
export const PRICING = {
  entryFeeCAD: 30,
  charityPortionCAD: 5,
  currency: 'CAD',
} as const;

/**
 * Labels for the 8 ranked 3rd-place advancer slots, shown in the wizard
 * and admin UI. Rank 1 = "best" 3rd-place team, rank 8 = "8th best".
 */
export const ADVANCER_RANK_LABELS: ReadonlyArray<string> = [
  'Best 3rd-Place Team',
  '2nd Best 3rd-Place Team',
  '3rd Best 3rd-Place Team',
  '4th Best 3rd-Place Team',
  '5th Best 3rd-Place Team',
  '6th Best 3rd-Place Team',
  '7th Best 3rd-Place Team',
  '8th Best 3rd-Place Team',
] as const;

export const ADVANCER_COUNT = 8;

export const ROUTES = {
  home: '/',
  predictions: '/predictions',
  leaderboard: '/leaderboard',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  admin: '/admin',
  account: '/account',
  about: '/about',
  charities: '/charities',
  rules: '/rules',
  terms: '/terms',
  privacy: '/privacy',
  referrals: '/referrals',
  rewards: '/rewards',
} as const;

/**
 * Charity partners receiving the {@link PRICING.charityPortionCAD} portion of
 * each entry. Surfaced on the landing page (DonationsToCharity), the About
 * page, and the dedicated /charities index + detail pages.
 */
export const CHARITIES = [
  {
    slug: 'canadian-cancer-society',
    name: 'Canadian Cancer Society',
    url: 'https://cancer.ca',
    displayUrl: 'cancer.ca',
    logo: '/charities/canadian-cancer-society.svg',
    tagline:
      "Nick's charity — supporting cancer research, prevention, and patient care across Canada.",
  },
  {
    slug: 'islamic-relief-canada',
    name: 'Islamic Relief Canada',
    url: 'https://islamicreliefcanada.org',
    displayUrl: 'islamicreliefcanada.org',
    logo: '/charities/islamic-relief-canada.png',
    tagline:
      "David's charity — emergency food, water, medical care, and shelter for families in Gaza and beyond.",
  },
] as const;

export type Charity = (typeof CHARITIES)[number];

/** 8 uppercase chars from a 31-symbol alphabet (no 0/O/1/I/L). */
export const REFERRAL_CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

export const API_ENDPOINTS = {
  tournament: '/api/tournament',
  predictions: '/api/predictions',
  leaderboard: '/api/leaderboard',
  teams: '/api/teams',
  groups: '/api/groups',
  knockoutMatches: '/api/knockout-matches',
} as const;

export const STORAGE_KEYS = {
  theme: 'wc2026-theme',
} as const;

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 8;

export const PREDICTION_NAME_REGEX = /^[A-Za-z0-9 _\-.''‘’]+$/;
export const PREDICTION_NAME_MAX = 60;
