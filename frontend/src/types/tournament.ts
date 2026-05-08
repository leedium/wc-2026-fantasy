/**
 * TypeScript types for WC2026 Tournament
 */

export type TournamentStatus = 'upcoming' | 'group_stage' | 'knockout' | 'completed';

export interface TournamentInfo {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  lockTime: Date;
  totalEntries: number;
  championTotalGoals: number | null;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  group: string;
}

export interface Group {
  id: string;
  name: string;
  teams: Team[];
}

export interface GroupPrediction {
  groupId: string;
  positions: {
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  };
}

export interface KnockoutMatchPrediction {
  matchId: string;
  winnerId: string | null;
}

export interface Predictions {
  groups: GroupPrediction[];
  knockout: KnockoutMatchPrediction[];
  totalGoals: number | null;
}

export interface PredictionSummary {
  id: string;
  name: string;
  totalGoals: number | null;
  submittedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
}

export interface PredictionDetail extends PredictionSummary {
  groups: GroupPrediction[];
  knockout: KnockoutMatchPrediction[];
}

export interface LeaderboardEntry {
  rank: number;
  predictionId: string;
  predictionName: string;
  username: string;
  points: number;
  change: number;
  groupPoints: number;
  knockoutPoints: number;
}

export interface LeaderboardRankMatch {
  predictionId: string;
  predictionName: string;
  rank: number;
  page: number;
  points: number;
}

export interface UserEntry {
  username: string;
  predictions: Predictions;
  points: number;
  rank: number | null;
  groupPoints: number;
  knockoutPoints: number;
  submittedAt: Date | null;
}

export type KnockoutStage =
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'third_place'
  | 'final';

export interface KnockoutMatch {
  id: string;
  stage: KnockoutStage;
  team1Source: string;
  team2Source: string;
  pointValue: number;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}
