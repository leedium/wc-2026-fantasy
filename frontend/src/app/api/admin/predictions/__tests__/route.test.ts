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
  return new NextRequest(`http://localhost:3000/api/admin/predictions${qs}`);
}

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

describe('GET /api/admin/predictions', () => {
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

  it('shapes admin_list_predictions into paginated response', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          id: 'p1',
          user_id: 'a',
          username: 'alice',
          email: 'alice@example.com',
          prediction_name: 'My Bracket',
          submitted_at: '2026-06-05T10:00:00Z',
          updated_at: '2026-06-06T12:00:00Z',
          total_count: 2,
        },
        {
          id: 'p2',
          user_id: 'b',
          username: 'bob',
          email: null,
          prediction_name: null,
          submitted_at: null,
          updated_at: '2026-06-04T09:00:00Z',
          total_count: 2,
        },
      ],
      error: null,
    });
    const res = await GET(req('?page=1&pageSize=25'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(25);
    expect(body.predictions).toHaveLength(2);
    expect(body.predictions[0]).toMatchObject({
      id: 'p1',
      userId: 'a',
      username: 'alice',
      email: 'alice@example.com',
      predictionName: 'My Bracket',
      submittedAt: '2026-06-05T10:00:00Z',
      updatedAt: '2026-06-06T12:00:00Z',
    });
    expect(body.predictions[1]).toMatchObject({
      userId: 'b',
      email: null,
      predictionName: null,
      submittedAt: null,
    });
  });
});
