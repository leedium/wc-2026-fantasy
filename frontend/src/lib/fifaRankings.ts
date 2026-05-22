// Source: FIFA Men's World Ranking (https://www.fifa.com/fifa-world-ranking).
// Hand-maintained; refresh after each official FIFA ranking publication.
// Last updated: 2026-05.

import type { Group, GroupPrediction } from '@/types/tournament';

export const FIFA_RANKINGS: Record<string, number> = {
  ESP: 1,
  ARG: 2,
  FRA: 3,
  ENG: 4,
  BRA: 5,
  POR: 6,
  NED: 7,
  BEL: 8,
  CRO: 9,
  GER: 11,
  MAR: 12,
  COL: 13,
  URU: 14,
  USA: 15,
  MEX: 16,
  SUI: 17,
  SEN: 18,
  JPN: 19,
  IRN: 21,
  KOR: 22,
  ECU: 24,
  AUS: 25,
  AUT: 26,
  CAN: 28,
  TUR: 30,
  NOR: 32,
  SWE: 33,
  ALG: 36,
  CZE: 37,
  EGY: 38,
  SCO: 39,
  CIV: 40,
  PAN: 41,
  PAR: 45,
  QAT: 50,
  TUN: 51,
  UZB: 55,
  RSA: 58,
  KSA: 59,
  COD: 60,
  CPV: 62,
  JOR: 64,
  IRQ: 68,
  BIH: 75,
  CUW: 80,
  HAI: 85,
  GHA: 86,
  NZL: 88,
};

export function autofillGroupPredictionsByFifaRanking(
  groups: Group[],
  rankings: Record<string, number> = FIFA_RANKINGS,
): GroupPrediction[] {
  return groups.map((group) => {
    const sorted = [...group.teams].sort(
      (a, b) => (rankings[a.code] ?? Infinity) - (rankings[b.code] ?? Infinity),
    );
    return {
      groupId: group.id,
      positions: {
        first: sorted[0]?.id ?? null,
        second: sorted[1]?.id ?? null,
        third: sorted[2]?.id ?? null,
        fourth: sorted[3]?.id ?? null,
      },
    };
  });
}
