/**
 * TypeScript types for WC2026 Tournament
 */

export type TournamentStatus = 'upcoming' | 'group_stage' | 'knockout' | 'completed';

export type TournamentPhase =
  | 'phase1'
  | 'phase1_locked'
  | 'phase2_open'
  | 'phase2_locked';

export interface TournamentInfo {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  lockTime: Date;
  knockoutLockTime: Date | null;
  knockoutUnlocked: boolean;
  phase: TournamentPhase;
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

export interface AdvancerPrediction {
  rank: number;
  teamId: string;
}

export interface TournamentAdvancer {
  rank: number;
  teamId: string;
}

export interface R32BracketAssignment {
  matchId: string;
  slot: 1 | 2;
  teamId: string;
}

export interface GroupStanding {
  groupId: string;
  firstTeamId: string | null;
  secondTeamId: string | null;
  thirdTeamId: string | null;
  fourthTeamId: string | null;
}

export interface Predictions {
  groups: GroupPrediction[];
  knockout: KnockoutMatchPrediction[];
  advancers: AdvancerPrediction[];
  totalGoals: number | null;
  championTeamId: string | null;
}

export interface PredictionSummary {
  id: string;
  name: string;
  totalGoals: number | null;
  championTeamId: string | null;
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
  /**
   * Owner's email. Present only when the caller is an admin (the API
   * route swaps in admin_get_leaderboard for admin sessions). Public
   * /api/leaderboard responses omit this field entirely.
   */
  email?: string;
  points: number;
  change: number;
  groupPoints: number;
  advancerPoints: number;
  knockoutPoints: number;
  championPickPoints: number;
  /** When the prediction's picks were last saved (predictions.updated_at). */
  updatedAt?: string | null;
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
  isSuperAdmin: boolean;
}
