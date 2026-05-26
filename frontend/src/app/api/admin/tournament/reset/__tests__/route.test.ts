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
  return new NextRequest('http://localhost:3000/api/admin/tournament/reset', {
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

describe('POST /api/admin/tournament/reset', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postReq({ id: 't1', confirm: 'RESET' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await POST(postReq({ id: 't1', confirm: 'RESET' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when id is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await POST(postReq({ confirm: 'RESET' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/id/);
  });

  it('returns 400 when confirm does not equal RESET', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await POST(postReq({ id: 't1', confirm: 'reset' }));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 403 when RPC raises forbidden (non-super-admin)', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'forbidden' } });
    const res = await POST(postReq({ id: 't1', confirm: 'RESET' }));
    expect(res.status).toBe(403);
  });

  it('returns 404 when RPC raises tournament not found', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'tournament not found' } });
    const res = await POST(postReq({ id: 't1', confirm: 'RESET' }));
    expect(res.status).toBe(404);
  });

  it('returns 200 and calls RPC on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: null });
    const res = await POST(postReq({ id: 't1', confirm: 'RESET' }));
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_reset_tournament', {
      p_tournament_id: 't1',
    });
  });
});
