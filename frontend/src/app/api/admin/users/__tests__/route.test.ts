/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  auth: { getUser: jest.fn() },
  from: jest.fn(),
  rpc: jest.fn(),
};

const adminMock = {
  auth: {
    admin: {
      createUser: jest.fn(),
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
const { GET, POST } = require('../route');

function req(qs = '') {
  return new NextRequest(`http://localhost:3000/api/admin/users${qs}`);
}

function mockAdminProfile(
  isAdmin: boolean,
  tournament: { id: string; lock_time: string } | null = null
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

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('shapes admin_list_users into paginated response', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true, { id: 't1', lock_time: '2026-06-01T00:00:00Z' });
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          id: 'a',
          username: 'alice',
          is_admin: false,
          is_super_admin: false,
          has_prediction: true,
          submitted_at: '2026-04-30T00:00:00Z',
          is_paid: true,
          paid_at: '2026-04-29T00:00:00Z',
          total_count: 2,
        },
        {
          id: 'b',
          username: 'bob',
          is_admin: true,
          is_super_admin: true,
          has_prediction: false,
          submitted_at: null,
          is_paid: false,
          paid_at: null,
          total_count: 2,
        },
      ],
      error: null,
    });
    const res = await GET(req('?page=1&pageSize=25'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toMatchObject({
      username: 'alice',
      isPaid: true,
      isSuperAdmin: false,
      paidAt: '2026-04-29T00:00:00Z',
    });
    expect(body.users[1]).toMatchObject({
      username: 'bob',
      isAdmin: true,
      isSuperAdmin: true,
      isPaid: false,
    });
    expect(body.tournament).toEqual({ id: 't1', lockTime: '2026-06-01T00:00:00Z' });
  });
});

function postReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    adminMock.auth.admin.createUser.mockReset();
  });

  it('returns 403 for non-admin caller', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await POST(
      postReq({ email: 'a@b.co', password: 'longenough', username: 'alice' })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid email', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await POST(
      postReq({ email: 'not-an-email', password: 'longenough', username: 'alice' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await POST(
      postReq({ email: 'a@b.co', password: 'short', username: 'alice' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid username format', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await POST(
      postReq({ email: 'a@b.co', password: 'longenough', username: '!!' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 when username taken', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    adminMock.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'username taken' },
    });
    const res = await POST(
      postReq({ email: 'a@b.co', password: 'longenough', username: 'taken' })
    );
    expect(res.status).toBe(409);
  });

  it('returns 201 with new user id on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    adminMock.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    });
    const res = await POST(
      postReq({
        email: 'a@b.co',
        password: 'longenough',
        username: 'alice',
        displayName: 'Alice',
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: 'new-user-id' });
    expect(adminMock.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.co',
        password: 'longenough',
        email_confirm: true,
        user_metadata: { username: 'alice', display_name: 'Alice' },
      })
    );
  });
});
