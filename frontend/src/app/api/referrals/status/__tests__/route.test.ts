/**
 * @jest-environment node
 */
export {}; // marks this file as a module so `supabaseMock` is local-scoped

const supabaseMock = {
  auth: { getUser: jest.fn() },
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route');

describe('GET /api/referrals/status', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns zeros when the RPC returns no row', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      code: null,
      availableCredits: 0,
      qualifiedTotal: 0,
      redeemedTotal: 0,
    });
  });

  it('maps the RPC row into the camelCase response', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          referral_code: 'ABCDEFGH',
          available_credits: 2,
          qualified_total: 5,
          redeemed_total: 3,
        },
      ],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      code: 'ABCDEFGH',
      availableCredits: 2,
      qualifiedTotal: 5,
      redeemedTotal: 3,
    });
  });

  it('returns 400 with safeMessage on DB error', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'not authenticated' },
    });
    const res = await GET();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not authenticated');
  });
});
