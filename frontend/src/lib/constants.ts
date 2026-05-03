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
// Knockout: per-team correct-side maxes — R16 16×5 + QF 8×6 + SF 4×8 + Final 2×10 = 180 — plus
// flat bonuses (champion 15, 3rd-place winner 5) = 200.
export const SCORING = {
  maxGroupPoints: 74,
  maxKnockoutPoints: 200,
  maxTotalPoints: 274,
} as const;

export const ROUTES = {
  home: '/',
  predictions: '/predictions',
  leaderboard: '/leaderboard',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  admin: '/admin',
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
