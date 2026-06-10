import { isPhase1Complete, isPhase1StagesComplete, needsPayment } from '../paymentStatus';
import { ADVANCER_COUNT, TOURNAMENT_CONFIG } from '@/lib/constants';

const fullGroups = Array.from({ length: TOURNAMENT_CONFIG.totalGroups }, (_, i) => ({
  groupId: String(i),
}));
const fullAdvancers = Array.from({ length: ADVANCER_COUNT }, (_, i) => ({
  rank: i + 1,
  teamId: `t${i}`,
}));

describe('isPhase1Complete', () => {
  it('is true with all 12 group rows + 8 advancer rows', () => {
    expect(
      isPhase1Complete({ isPaid: false, submittedAt: null, groups: fullGroups, advancers: fullAdvancers })
    ).toBe(true);
  });

  it('is false when group or advancer rows are incomplete', () => {
    expect(
      isPhase1Complete({ isPaid: false, submittedAt: null, groups: fullGroups.slice(0, 5), advancers: fullAdvancers })
    ).toBe(false);
    expect(
      isPhase1Complete({ isPaid: false, submittedAt: null, groups: fullGroups, advancers: [] })
    ).toBe(false);
  });
});

describe('isPhase1StagesComplete', () => {
  it('is true with all groups + advancers + a champion pick', () => {
    expect(
      isPhase1StagesComplete({
        isPaid: false,
        submittedAt: null,
        groups: fullGroups,
        advancers: fullAdvancers,
        championTeamId: 'team-x',
      })
    ).toBe(true);
  });

  it('is false when the champion pick is missing (even if groups + advancers are full)', () => {
    expect(
      isPhase1StagesComplete({
        isPaid: false,
        submittedAt: null,
        groups: fullGroups,
        advancers: fullAdvancers,
        championTeamId: null,
      })
    ).toBe(false);
  });

  it('is false when groups or advancers are incomplete', () => {
    expect(
      isPhase1StagesComplete({
        isPaid: false,
        submittedAt: null,
        groups: fullGroups.slice(0, 5),
        advancers: fullAdvancers,
        championTeamId: 'team-x',
      })
    ).toBe(false);
  });
});

describe('needsPayment', () => {
  it('flags a Phase 1 saved draft (submittedAt null but complete) that is unpaid', () => {
    expect(
      needsPayment({ isPaid: false, submittedAt: null, groups: fullGroups, advancers: fullAdvancers })
    ).toBe(true);
  });

  it('flags an explicitly-submitted unpaid prediction', () => {
    expect(
      needsPayment({ isPaid: false, submittedAt: '2026-06-01T00:00:00Z', groups: [], advancers: [] })
    ).toBe(true);
  });

  it('does not flag a paid prediction', () => {
    expect(
      needsPayment({ isPaid: true, submittedAt: null, groups: fullGroups, advancers: fullAdvancers })
    ).toBe(false);
  });

  it('does not flag a genuinely-incomplete unsubmitted draft', () => {
    expect(
      needsPayment({ isPaid: false, submittedAt: null, groups: fullGroups.slice(0, 3), advancers: [] })
    ).toBe(false);
  });
});
