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

function mockProfileAndTournament(
  isAdmin: boolean,
  tournament: { id: string; status: string; lock_time: string } | null = {
    id: 't1',
    status: 'upcoming',
    lock_time: new Date(Date.now() + 86_400_000).toISOString(),
  }
) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'tournaments') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: tournament, error: null }) }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
      }),
    };
  });
}

describe('GET /api/admin/stats', () => {
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

  it('returns 403 when authenticated but not admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockProfileAndTournament(false);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 404 when no active tournament', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin1' } } });
    mockProfileAndTournament(true, null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('shapes RPC output and derives pot + charity totals', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin1' } } });
    mockProfileAndTournament(true);
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          total_registrations: 50,
          users_with_paid_prediction: 12,
          total_entries: 20,
          cash_paid_count: 18,
          free_entries: 2,
          referral_credits_earned: 3,
          referral_credits_redeemed: 1,
          loyalty_credits_earned: 2,
          loyalty_credits_redeemed: 0,
          top_champion_team_id: 'bra',
          top_champion_pick_count: 7,
          top_users: [
            { user_id: 'a', username: 'alice', email: 'a@x', paid_count: 5 },
            { user_id: 'b', username: 'bob', email: 'b@x', paid_count: 3 },
          ],
        },
      ],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_get_dashboard_stats', {
      p_tournament_id: 't1',
    });
    expect(body.tournament.isLocked).toBe(false);
    expect(body.totalEntries).toBe(20);
    expect(body.cashPaidCount).toBe(18);
    expect(body.potTotalCAD).toBe(18 * 30);
    expect(body.charityTotalCAD).toBe(18 * 5);
    expect(body.topChampionTeamId).toBe('bra');
    expect(body.topUsers).toEqual([
      { userId: 'a', username: 'alice', email: 'a@x', paidCount: 5 },
      { userId: 'b', username: 'bob', email: 'b@x', paidCount: 3 },
    ]);
  });

  it('marks tournament as locked when lock_time has passed', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin1' } } });
    mockProfileAndTournament(true, {
      id: 't1',
      status: 'group_stage',
      lock_time: new Date(Date.now() - 60_000).toISOString(),
    });
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    const res = await GET();
    const body = await res.json();
    expect(body.tournament.isLocked).toBe(true);
  });
});
