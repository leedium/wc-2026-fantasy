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
  return new NextRequest('http://localhost:3000/api/admin/group-standings', {
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

describe('POST /api/admin/group-standings', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await POST(
      postReq({ tournamentId: 't1', groupId: 'A', first: 'a', second: 'b', third: 'c', fourth: 'd' })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when fields are missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await POST(postReq({ tournamentId: 't1', groupId: 'A' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 with rpc error when teams mismatch group', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'team x does not belong to group A' },
    });
    const res = await POST(
      postReq({ tournamentId: 't1', groupId: 'A', first: 'x', second: 'b', third: 'c', fourth: 'd' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 and forwards rpc args on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      postReq({ tournamentId: 't1', groupId: 'A', first: 'a', second: 'b', third: 'c', fourth: 'd' })
    );
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_group_standing', {
      p_tournament_id: 't1',
      p_group_id: 'A',
      p_first: 'a',
      p_second: 'b',
      p_third: 'c',
      p_fourth: 'd',
    });
  });
});
