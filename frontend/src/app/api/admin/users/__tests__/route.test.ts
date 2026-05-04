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
const { GET } = require('../route');

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
      paidAt: '2026-04-29T00:00:00Z',
    });
    expect(body.users[1]).toMatchObject({ username: 'bob', isAdmin: true, isPaid: false });
    expect(body.tournament).toEqual({ id: 't1', lockTime: '2026-06-01T00:00:00Z' });
  });
});
