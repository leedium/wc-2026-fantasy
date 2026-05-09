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
// Bundles: 8 best-3rd-of-bundle picks × 0.5 = 4.
// Knockout: per-team correct-side maxes — R16 16×5 + QF 8×6 + SF 4×8 + Final 2×10 = 180 — plus
// flat bonuses (champion 15, 3rd-place winner 5) = 200.
export const SCORING = {
  maxGroupPoints: 74,
  maxBundlePoints: 4,
  maxKnockoutPoints: 200,
  maxTotalPoints: 278,
} as const;

/**
 * Eight FIFA-2026 R32 "best 3rd of bundle" slots. Each slot is fed by the
 * best-ranked third-place team among 5 specified groups. Mirrors the
 * `third_place_bundles` reference table in the DB.
 */
export const BUNDLE_SLOTS: ReadonlyArray<{
  slotIndex: number;
  allowedLetters: ReadonlyArray<string>;
  r32MatchId: string;
  bundleKey: string;
}> = [
  { slotIndex: 0, allowedLetters: ['A', 'B', 'C', 'D', 'F'], r32MatchId: 'M2', bundleKey: 'ABCDF' },
  { slotIndex: 1, allowedLetters: ['C', 'D', 'F', 'G', 'H'], r32MatchId: 'M5', bundleKey: 'CDFGH' },
  { slotIndex: 2, allowedLetters: ['C', 'E', 'F', 'H', 'I'], r32MatchId: 'M7', bundleKey: 'CEFHI' },
  { slotIndex: 3, allowedLetters: ['E', 'H', 'I', 'J', 'K'], r32MatchId: 'M8', bundleKey: 'EHIJK' },
  { slotIndex: 4, allowedLetters: ['B', 'E', 'F', 'I', 'J'], r32MatchId: 'M9', bundleKey: 'BEFIJ' },
  { slotIndex: 5, allowedLetters: ['A', 'E', 'H', 'I', 'J'], r32MatchId: 'M10', bundleKey: 'AEHIJ' },
  { slotIndex: 6, allowedLetters: ['E', 'F', 'G', 'I', 'J'], r32MatchId: 'M13', bundleKey: 'EFGIJ' },
  { slotIndex: 7, allowedLetters: ['D', 'E', 'I', 'J', 'L'], r32MatchId: 'M15', bundleKey: 'DEIJL' },
] as const;

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
} as const;

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
export const PREDICTION_CAP = 5;
