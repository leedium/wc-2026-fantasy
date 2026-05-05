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
const { PATCH, DELETE } = require('../route');

function patchReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/users/u2', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteReq() {
  return new NextRequest('http://localhost:3000/api/admin/users/u2', {
    method: 'DELETE',
  });
}

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchReq({ username: 'newname' }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin caller', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await PATCH(patchReq({ username: 'newname' }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when neither username nor displayName provided', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({}), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(400);
  });

  it('returns 409 when username taken', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'username taken' } });
    const res = await PATCH(patchReq({ username: 'taken' }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 400 when username invalid format', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'username invalid format' },
    });
    const res = await PATCH(patchReq({ username: '!!' }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'user not found' } });
    const res = await PATCH(patchReq({ username: 'newname' }), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success and forwards both fields', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchReq({ username: 'newname', displayName: 'New' }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_update_profile', {
      p_user_id: 'u2',
      p_username: 'newname',
      p_display_name: 'New',
    });
  });
});

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin caller', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(403);
  });

  it('returns 400 when admin tries to delete self', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'cannot delete self' } });
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'u1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when target is super admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'cannot delete super admin' },
    });
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('cannot delete super admin');
  });

  it('returns 400 when target is admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'cannot delete admin' },
    });
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('cannot delete admin');
  });

  it('returns 404 when user not found', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'user not found' } });
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'gone' }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_delete_user', { p_user_id: 'u2' });
  });
});
