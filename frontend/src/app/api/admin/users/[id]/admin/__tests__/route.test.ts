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
const { PATCH } = require('../route');

function patchReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/users/u2/admin', {
    method: 'PATCH',
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

describe('PATCH /api/admin/users/[id]/admin', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 403 for non-admin caller', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await PATCH(patchReq({ isAdmin: true }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when isAdmin is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({}), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 with rpc error when demoting super admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'cannot demote super admin' },
    });
    const res = await PATCH(patchReq({ isAdmin: false }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('super admin');
  });

  it('returns 400 with rpc error when demoting last admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'cannot demote last admin' } });
    const res = await PATCH(patchReq({ isAdmin: false }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cannot demote');
  });

  it('returns 200 on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchReq({ isAdmin: true }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_user_admin', {
      p_user_id: 'u2',
      p_is_admin: true,
    });
  });
});
