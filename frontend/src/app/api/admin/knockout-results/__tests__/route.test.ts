/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');

function postReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/knockout-results', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

describe('POST /api/admin/knockout-results', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await POST(
      postReq({ tournamentId: 't1', matchId: 'M1', winnerTeamId: 'a', loserTeamId: 'b' })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await POST(postReq({ tournamentId: 't1', matchId: 'M1' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 and forwards rpc args on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      postReq({
        tournamentId: 't1',
        matchId: 'M1',
        winnerTeamId: 'a',
        loserTeamId: 'b',
        totalGoals: 3,
      })
    );
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_knockout_result', {
      p_tournament_id: 't1',
      p_match_id: 'M1',
      p_winner_team_id: 'a',
      p_loser_team_id: 'b',
      p_total_goals: 3,
    });
  });
});
