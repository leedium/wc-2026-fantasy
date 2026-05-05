/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  auth: {
    getUser: jest.fn(),
    resetPasswordForEmail: jest.fn(),
  },
  from: jest.fn(),
};

const adminMock = {
  auth: {
    admin: {
      getUserById: jest.fn(),
    },
  },
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => adminMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');

function postReq() {
  return new NextRequest('http://localhost:3000/api/admin/users/u2/password-reset', {
    method: 'POST',
  });
}

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

describe('POST /api/admin/users/[id]/password-reset', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.resetPasswordForEmail.mockReset();
    supabaseMock.from.mockReset();
    adminMock.auth.admin.getUserById.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin caller', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(403);
  });

  it('returns 500 when admin lookup errors', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    adminMock.auth.admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: { message: 'service role required' },
    });
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'gone' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('service role required');
  });

  it('returns 404 when target user does not exist', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    adminMock.auth.admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'gone' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 when target user has no email', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    adminMock.auth.admin.getUserById.mockResolvedValue({
      data: { user: { id: 'u2', email: null } },
      error: null,
    });
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no email');
  });

  it('triggers reset email and returns 200', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    adminMock.auth.admin.getUserById.mockResolvedValue({
      data: { user: { id: 'u2', email: 'target@example.com' } },
      error: null,
    });
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(200);
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'target@example.com',
      expect.objectContaining({
        redirectTo: expect.stringContaining('/auth/callback?next=/reset-password'),
      })
    );
  });
});
