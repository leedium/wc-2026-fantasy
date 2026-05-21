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
const { GET, POST } = require('../route');

function getReq() {
  return new NextRequest('http://localhost:3000/api/admin/users/u2/predictions');
}
function postReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/users/u2/predictions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin user predictions', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('GET returns 403 when caller is not admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { is_admin: false } }) }),
      }),
    }));
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(403);
  });

  it('POST forwards admin_submit_predictions on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { is_admin: true } }) }),
      }),
    }));
    supabaseMock.rpc.mockResolvedValue({ data: 'pred-id', error: null });
    const res = await POST(
      postReq({
        tournamentId: 't1',
        predictionName: 'Main',
        totalGoals: 25,
        championTeamId: 'team-arg',
        groups: [],
        knockout: [],
      }),
      { params: Promise.resolve({ id: 'u2' }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictionId: 'pred-id' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'admin_submit_predictions',
      expect.objectContaining({
        p_user_id: 'u2',
        payload: expect.objectContaining({ champion_team_id: 'team-arg' }),
      })
    );
  });

  it('POST returns 400 when championTeamId missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { is_admin: true } }) }),
      }),
    }));
    const res = await POST(
      postReq({
        tournamentId: 't1',
        predictionName: 'Main',
        totalGoals: 25,
        groups: [],
        knockout: [],
      }),
      { params: Promise.resolve({ id: 'u2' }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/championTeamId/);
  });
});
