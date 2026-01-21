/**
 * Mock data for WC2026 Tournament development
 */

import type {
  Group,
  KnockoutMatch,
  LeaderboardEntry,
  Predictions,
  Team,
  TournamentInfo,
  UserEntry,
} from '@/types/tournament';
import { ENTRY_FEE_SOL } from './constants';

// Tournament lock time - 30 days from now for development
const LOCK_TIME = new Date();
LOCK_TIME.setDate(LOCK_TIME.getDate() + 30);

// Mock tournament info
export const mockTournamentInfo: TournamentInfo = {
  status: 'upcoming',
  lockTime: LOCK_TIME,
  entryFee: ENTRY_FEE_SOL,
  prizePool: 1250.5,
  totalEntries: 12505,
};

// All 48 teams for WC2026
export const mockTeams: Team[] = [
  // Group A
  { id: 'usa', name: 'United States', code: 'USA', group: 'A' },
  { id: 'mex', name: 'Mexico', code: 'MEX', group: 'A' },
  { id: 'can', name: 'Canada', code: 'CAN', group: 'A' },
  { id: 'jam', name: 'Jamaica', code: 'JAM', group: 'A' },
  // Group B
  { id: 'arg', name: 'Argentina', code: 'ARG', group: 'B' },
  { id: 'col', name: 'Colombia', code: 'COL', group: 'B' },
  { id: 'par', name: 'Paraguay', code: 'PAR', group: 'B' },
  { id: 'ecu', name: 'Ecuador', code: 'ECU', group: 'B' },
  // Group C
  { id: 'bra', name: 'Brazil', code: 'BRA', group: 'C' },
  { id: 'uru', name: 'Uruguay', code: 'URU', group: 'C' },
  { id: 'ven', name: 'Venezuela', code: 'VEN', group: 'C' },
  { id: 'per', name: 'Peru', code: 'PER', group: 'C' },
  // Group D
  { id: 'eng', name: 'England', code: 'ENG', group: 'D' },
  { id: 'fra', name: 'France', code: 'FRA', group: 'D' },
  { id: 'ned', name: 'Netherlands', code: 'NED', group: 'D' },
  { id: 'wal', name: 'Wales', code: 'WAL', group: 'D' },
  // Group E
  { id: 'ger', name: 'Germany', code: 'GER', group: 'E' },
  { id: 'esp', name: 'Spain', code: 'ESP', group: 'E' },
  { id: 'por', name: 'Portugal', code: 'POR', group: 'E' },
  { id: 'sui', name: 'Switzerland', code: 'SUI', group: 'E' },
  // Group F
  { id: 'ita', name: 'Italy', code: 'ITA', group: 'F' },
  { id: 'bel', name: 'Belgium', code: 'BEL', group: 'F' },
  { id: 'cro', name: 'Croatia', code: 'CRO', group: 'F' },
  { id: 'aut', name: 'Austria', code: 'AUT', group: 'F' },
  // Group G
  { id: 'jpn', name: 'Japan', code: 'JPN', group: 'G' },
  { id: 'kor', name: 'South Korea', code: 'KOR', group: 'G' },
  { id: 'aus', name: 'Australia', code: 'AUS', group: 'G' },
  { id: 'sau', name: 'Saudi Arabia', code: 'KSA', group: 'G' },
  // Group H
  { id: 'irn', name: 'Iran', code: 'IRN', group: 'H' },
  { id: 'qat', name: 'Qatar', code: 'QAT', group: 'H' },
  { id: 'uae', name: 'UAE', code: 'UAE', group: 'H' },
  { id: 'uzb', name: 'Uzbekistan', code: 'UZB', group: 'H' },
  // Group I
  { id: 'sen', name: 'Senegal', code: 'SEN', group: 'I' },
  { id: 'mar', name: 'Morocco', code: 'MAR', group: 'I' },
  { id: 'nig', name: 'Nigeria', code: 'NGA', group: 'I' },
  { id: 'cam', name: 'Cameroon', code: 'CMR', group: 'I' },
  // Group J
  { id: 'egy', name: 'Egypt', code: 'EGY', group: 'J' },
  { id: 'alg', name: 'Algeria', code: 'ALG', group: 'J' },
  { id: 'gha', name: 'Ghana', code: 'GHA', group: 'J' },
  { id: 'tun', name: 'Tunisia', code: 'TUN', group: 'J' },
  // Group K
  { id: 'pol', name: 'Poland', code: 'POL', group: 'K' },
  { id: 'den', name: 'Denmark', code: 'DEN', group: 'K' },
  { id: 'swe', name: 'Sweden', code: 'SWE', group: 'K' },
  { id: 'cze', name: 'Czech Republic', code: 'CZE', group: 'K' },
  // Group L
  { id: 'ser', name: 'Serbia', code: 'SRB', group: 'L' },
  { id: 'ukr', name: 'Ukraine', code: 'UKR', group: 'L' },
  { id: 'sco', name: 'Scotland', code: 'SCO', group: 'L' },
  { id: 'nor', name: 'Norway', code: 'NOR', group: 'L' },
];

// Group IDs
const GROUP_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// Mock groups
export const mockGroups: Group[] = GROUP_IDS.map((id) => ({
  id,
  name: `Group ${id}`,
  teams: mockTeams.filter((team) => team.group === id),
}));

// Helper to get teams by group
export function getTeamsByGroup(groupId: string): Team[] {
  return mockTeams.filter((team) => team.group === groupId);
}

// Helper to get team by id
export function getTeamById(teamId: string): Team | undefined {
  return mockTeams.find((team) => team.id === teamId);
}

// Generate mock leaderboard entries (50+ entries)
function generateMockLeaderboard(): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  const walletPrefixes = [
    '7xKX',
    '9Yz8',
    'BnQ2',
    'Cj7P',
    'DmR4',
    'FkS6',
    'GhT9',
    'HwU1',
    'JpV3',
    'KrW5',
    'LsX7',
    'MtY8',
    'NuZ0',
    'PvA2',
    'QwB4',
    'RxC6',
    'SyD8',
    'TzE1',
    'UaF3',
    'VbG5',
    'WcH7',
    'XdI9',
    'YeJ0',
    'ZfK2',
    'AgL4',
    'BhM6',
    'CiN8',
    'DjO1',
    'EkP3',
    'FlQ5',
    'GmR7',
    'HnS9',
    'IoT0',
    'JpU2',
    'KqV4',
    'LrW6',
    'MsX8',
    'NtY1',
    'OuZ3',
    'PvA5',
    'QwB7',
    'RxC9',
    'SyD0',
    'TzE2',
    'UaF4',
    'VbG6',
    'WcH8',
    'XdI1',
    'YeJ3',
    'ZfK5',
    '1gL7',
    '2hM9',
    '3iN0',
    '4jO2',
  ];

  for (let i = 0; i < walletPrefixes.length; i++) {
    const groupPoints = Math.floor(Math.random() * 80) + 20; // 20-100
    const knockoutPoints = Math.floor(Math.random() * 100) + 30; // 30-130
    const points = groupPoints + knockoutPoints;
    const change = Math.random() > 0.6 ? Math.floor(Math.random() * 10) - 5 : 0; // -5 to +5 or 0

    entries.push({
      rank: i + 1, // Will be sorted
      wallet: `${walletPrefixes[i]}${'x'.repeat(36)}${(i + 1).toString().padStart(4, '0')}`,
      points,
      change,
      groupPoints,
      knockoutPoints,
    });
  }

  // Sort by points descending and assign ranks
  entries.sort((a, b) => b.points - a.points);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

export const mockLeaderboard: LeaderboardEntry[] = generateMockLeaderboard();

// Empty predictions template
export const emptyPredictions: Predictions = {
  groups: GROUP_IDS.map((groupId) => ({
    groupId,
    positions: {
      first: null,
      second: null,
      third: null,
      fourth: null,
    },
  })),
  knockout: [], // Will be populated based on knockout matches
  totalGoals: null,
};

// Mock user entry (partially filled predictions for demo)
export const mockUserEntry: UserEntry = {
  wallet: 'DemoUserWallet123456789abcdefghijklmnop',
  predictions: {
    groups: [
      {
        groupId: 'A',
        positions: { first: 'usa', second: 'mex', third: 'can', fourth: 'jam' },
      },
      {
        groupId: 'B',
        positions: {
          first: 'arg',
          second: 'col',
          third: 'ecu',
          fourth: 'par',
        },
      },
      {
        groupId: 'C',
        positions: {
          first: 'bra',
          second: 'uru',
          third: 'ven',
          fourth: 'per',
        },
      },
      {
        groupId: 'D',
        positions: {
          first: 'fra',
          second: 'eng',
          third: 'ned',
          fourth: 'wal',
        },
      },
      {
        groupId: 'E',
        positions: {
          first: 'esp',
          second: 'ger',
          third: 'por',
          fourth: 'sui',
        },
      },
      {
        groupId: 'F',
        positions: {
          first: 'ita',
          second: 'bel',
          third: 'cro',
          fourth: 'aut',
        },
      },
      // Remaining groups not filled yet for demo
      {
        groupId: 'G',
        positions: { first: null, second: null, third: null, fourth: null },
      },
      {
        groupId: 'H',
        positions: { first: null, second: null, third: null, fourth: null },
      },
      {
        groupId: 'I',
        positions: { first: null, second: null, third: null, fourth: null },
      },
      {
        groupId: 'J',
        positions: { first: null, second: null, third: null, fourth: null },
      },
      {
        groupId: 'K',
        positions: { first: null, second: null, third: null, fourth: null },
      },
      {
        groupId: 'L',
        positions: { first: null, second: null, third: null, fourth: null },
      },
    ],
    knockout: [],
    totalGoals: 172,
  },
  points: 0,
  rank: null,
  groupPoints: 0,
  knockoutPoints: 0,
  hasPaid: false,
  submittedAt: null,
};

// Knockout bracket structure (31 matches total)
// Round of 32: 16 matches, Round of 16: 8 matches, QF: 4, SF: 2, 3rd place: 1, Final: 1
export const knockoutMatches: KnockoutMatch[] = [
  // Round of 32 (16 matches, +2 points each)
  { id: 'M1', stage: 'round_of_32', team1Source: '1A', team2Source: '2B', pointValue: 2 },
  { id: 'M2', stage: 'round_of_32', team1Source: '1C', team2Source: '2D', pointValue: 2 },
  { id: 'M3', stage: 'round_of_32', team1Source: '1E', team2Source: '2F', pointValue: 2 },
  { id: 'M4', stage: 'round_of_32', team1Source: '1G', team2Source: '2H', pointValue: 2 },
  { id: 'M5', stage: 'round_of_32', team1Source: '1I', team2Source: '2J', pointValue: 2 },
  { id: 'M6', stage: 'round_of_32', team1Source: '1K', team2Source: '2L', pointValue: 2 },
  { id: 'M7', stage: 'round_of_32', team1Source: '1B', team2Source: '2A', pointValue: 2 },
  { id: 'M8', stage: 'round_of_32', team1Source: '1D', team2Source: '2C', pointValue: 2 },
  { id: 'M9', stage: 'round_of_32', team1Source: '1F', team2Source: '2E', pointValue: 2 },
  { id: 'M10', stage: 'round_of_32', team1Source: '1H', team2Source: '2G', pointValue: 2 },
  { id: 'M11', stage: 'round_of_32', team1Source: '1J', team2Source: '2I', pointValue: 2 },
  { id: 'M12', stage: 'round_of_32', team1Source: '1L', team2Source: '2K', pointValue: 2 },
  { id: 'M13', stage: 'round_of_32', team1Source: '3A', team2Source: '3B', pointValue: 2 },
  { id: 'M14', stage: 'round_of_32', team1Source: '3C', team2Source: '3D', pointValue: 2 },
  { id: 'M15', stage: 'round_of_32', team1Source: '3E', team2Source: '3F', pointValue: 2 },
  { id: 'M16', stage: 'round_of_32', team1Source: '3G', team2Source: '3H', pointValue: 2 },
  // Round of 16 (8 matches, +4 points each)
  { id: 'M17', stage: 'round_of_16', team1Source: 'M1', team2Source: 'M2', pointValue: 4 },
  { id: 'M18', stage: 'round_of_16', team1Source: 'M3', team2Source: 'M4', pointValue: 4 },
  { id: 'M19', stage: 'round_of_16', team1Source: 'M5', team2Source: 'M6', pointValue: 4 },
  { id: 'M20', stage: 'round_of_16', team1Source: 'M7', team2Source: 'M8', pointValue: 4 },
  { id: 'M21', stage: 'round_of_16', team1Source: 'M9', team2Source: 'M10', pointValue: 4 },
  { id: 'M22', stage: 'round_of_16', team1Source: 'M11', team2Source: 'M12', pointValue: 4 },
  { id: 'M23', stage: 'round_of_16', team1Source: 'M13', team2Source: 'M14', pointValue: 4 },
  { id: 'M24', stage: 'round_of_16', team1Source: 'M15', team2Source: 'M16', pointValue: 4 },
  // Quarter-finals (4 matches, +8 points each)
  { id: 'M25', stage: 'quarter_finals', team1Source: 'M17', team2Source: 'M18', pointValue: 8 },
  { id: 'M26', stage: 'quarter_finals', team1Source: 'M19', team2Source: 'M20', pointValue: 8 },
  { id: 'M27', stage: 'quarter_finals', team1Source: 'M21', team2Source: 'M22', pointValue: 8 },
  { id: 'M28', stage: 'quarter_finals', team1Source: 'M23', team2Source: 'M24', pointValue: 8 },
  // Semi-finals (2 matches, +15 points each)
  { id: 'M29', stage: 'semi_finals', team1Source: 'M25', team2Source: 'M26', pointValue: 15 },
  { id: 'M30', stage: 'semi_finals', team1Source: 'M27', team2Source: 'M28', pointValue: 15 },
  // Third place match (+10 points)
  { id: 'M31', stage: 'third_place', team1Source: 'L-M29', team2Source: 'L-M30', pointValue: 10 },
  // Final (+25 points)
  { id: 'M32', stage: 'final', team1Source: 'M29', team2Source: 'M30', pointValue: 25 },
];

// Helper to get knockout matches by stage
export function getKnockoutMatchesByStage(stage: KnockoutMatch['stage']): KnockoutMatch[] {
  return knockoutMatches.filter((match) => match.stage === stage);
}
