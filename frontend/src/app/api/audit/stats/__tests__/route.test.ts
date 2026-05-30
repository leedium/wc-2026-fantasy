/**
 * @jest-environment node
 */
const supabaseMock = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route');

function mockTournament(data: unknown) {
  supabaseMock.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data, error: null }),
      }),
    }),
  });
}

describe('GET /api/audit/stats', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns mapped aggregate counts for a signed-in user', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockTournament({ id: 't1', status: 'group_stage', lock_time: '2026-06-01T00:00:00Z' });
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          total_registrations: 50,
          users_with_paid_prediction: 20,
          total_entries: 25,
          cash_paid_count: 22,
          free_entries: 3,
          referral_credits_redeemed: 2,
          loyalty_credits_redeemed: 1,
        },
      ],
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_audit_stats', { p_tournament_id: 't1' });
    expect(body).toMatchObject({
      tournament: { id: 't1', status: 'group_stage' },
      totalRegistrations: 50,
      usersWithPaidPrediction: 20,
      totalEntries: 25,
      cashPaidCount: 22,
      freeEntries: 3,
      referralCreditsRedeemed: 2,
      loyaltyCreditsRedeemed: 1,
    });
    // No PII leaks through.
    expect(JSON.stringify(body)).not.toMatch(/email|username|top_users/i);
  });

  it('returns 404 when there is no active tournament', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockTournament(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
