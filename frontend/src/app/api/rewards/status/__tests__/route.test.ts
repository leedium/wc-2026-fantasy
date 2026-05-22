/**
 * @jest-environment node
 */
export {};

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

function mockTournament(data: { id: string } | null) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data, error: null }) }),
    }),
  }));
}

describe('GET /api/rewards/status', () => {
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

  it('returns 404 when no active tournament', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockTournament(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('maps the flat RPC row into the nested response shape', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockTournament({ id: 't1' });
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          referral_code: 'ABCD2345',
          total_available: 3,
          referral_available: 2,
          referral_qualified: 4,
          referral_redeemed: 2,
          loyalty_available: 1,
          loyalty_earned: 1,
          loyalty_redeemed: 0,
          loyalty_cash_paid: 7,
        },
      ],
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      referralCode: 'ABCD2345',
      totalAvailable: 3,
      referral: { available: 2, qualifiedTotal: 4, redeemedTotal: 2 },
      loyalty: { available: 1, earned: 1, redeemed: 0, cashPaid: 7 },
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_rewards_status', {
      p_tournament_id: 't1',
    });
  });

  it('returns a zero-shape when the RPC returns no row', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockTournament({ id: 't1' });
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      referralCode: null,
      totalAvailable: 0,
      referral: { available: 0, qualifiedTotal: 0, redeemedTotal: 0 },
      loyalty: { available: 0, earned: 0, redeemed: 0, cashPaid: 0 },
    });
  });

  it('returns 400 when the RPC errors', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockTournament({ id: 't1' });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'not authenticated' },
    });

    const res = await GET();
    expect(res.status).toBe(400);
  });
});
