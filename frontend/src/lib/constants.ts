/**
 * Application constants for WC2026 Prediction Game
 */

// Entry fee in SOL
export const ENTRY_FEE_SOL = 0.1;

// Tournament configuration
export const TOURNAMENT_CONFIG = {
  totalTeams: 48,
  totalGroups: 12,
  teamsPerGroup: 4,
  totalMatches: 104,
} as const;

// Scoring points
export const SCORING = {
  maxGroupPoints: 120,
  maxKnockoutPoints: 163,
  maxTotalPoints: 283,
} as const;

// Route paths
export const ROUTES = {
  home: '/',
  predictions: '/predictions',
  leaderboard: '/leaderboard',
  results: '/results',
} as const;

// API endpoints (relative to API_URL)
export const API_ENDPOINTS = {
  tournament: '/tournament',
  predictions: '/predictions',
  leaderboard: '/leaderboard',
  results: '/results',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  theme: 'wc2026-theme',
  network: 'wc2026-network',
} as const;
