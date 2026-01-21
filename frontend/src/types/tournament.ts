/**
 * TypeScript types for WC2026 Tournament
 */

// Tournament status
export type TournamentStatus = 'upcoming' | 'group_stage' | 'knockout' | 'completed';

// Tournament info
export interface TournamentInfo {
  status: TournamentStatus;
  lockTime: Date;
  entryFee: number; // in SOL
  prizePool: number; // in SOL
  totalEntries: number;
}

// Team
export interface Team {
  id: string;
  name: string;
  code: string; // 3-letter country code
  group: string; // A-L
}

// Group (A-L)
export interface Group {
  id: string; // A-L
  name: string; // "Group A", "Group B", etc.
  teams: Team[];
}

// Group stage prediction (positions 1-4 for a group)
export interface GroupPrediction {
  groupId: string;
  positions: {
    first: string | null; // team id
    second: string | null;
    third: string | null;
    fourth: string | null;
  };
}

// Knockout match prediction
export interface KnockoutMatchPrediction {
  matchId: string; // M1, M2, etc.
  winnerId: string | null; // team id
}

// Full predictions structure
export interface Predictions {
  groups: GroupPrediction[];
  knockout: KnockoutMatchPrediction[];
  totalGoals: number | null; // tiebreaker
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  points: number;
  change: number; // positive = up, negative = down, 0 = no change
  groupPoints: number;
  knockoutPoints: number;
}

// User entry (current user's data)
export interface UserEntry {
  wallet: string;
  predictions: Predictions;
  points: number;
  rank: number | null;
  groupPoints: number;
  knockoutPoints: number;
  hasPaid: boolean;
  submittedAt: Date | null;
}

// Knockout stage type
export type KnockoutStage =
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'third_place'
  | 'final';

// Knockout match with metadata
export interface KnockoutMatch {
  id: string;
  stage: KnockoutStage;
  team1Source: string; // e.g., "1A" (winner of group A) or "M1" (winner of match M1)
  team2Source: string;
  pointValue: number;
}
