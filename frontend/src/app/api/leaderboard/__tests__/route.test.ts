/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route');

function req(qs = '') {
  return new NextRequest(`http://localhost:3000/api/leaderboard${qs}`);
}

function mockTournamentLookup() {
  return {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 't1' } }) }) }),
  };
}

function mockProfileLookup(isAdmin: boolean) {
  return {
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  };
}

describe('GET /api/leaderboard', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.auth.getUser.mockReset();
    // Default: authenticated non-admin caller (the leaderboard is login-gated).
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req('?page=1&pageSize=25'));
    expect(res.status).toBe(401);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns empty list when no active tournament', async () => {
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }));
    const res = await GET(req('?page=1&pageSize=25'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], total: 0, page: 1, pageSize: 25 });
  });

  it('shapes the RPC result into paginated entries (non-admin, no email)', async () => {
    let callIdx = 0;
    supabaseMock.from.mockImplementation(() => {
      const handler = callIdx === 0 ? mockTournamentLookup() : mockProfileLookup(false);
      callIdx += 1;
      return handler;
    });
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          username: 'alice',
          points: 100,
          group_points: 60,
          knockout_points: 40,
          total_goals: 170,
          updated_at: '2026-05-29T12:00:00.000Z',
          total_count: 2,
        },
        {
          rank: 2,
          username: 'bob',
          points: 90,
          group_points: 55,
          knockout_points: 35,
          total_goals: 175,
          total_count: 2,
        },
      ],
      error: null,
    });
    const res = await GET(req('?page=1&pageSize=25'));
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0]).toMatchObject({
      rank: 1,
      username: 'alice',
      points: 100,
      groupPoints: 60,
      knockoutPoints: 40,
      updatedAt: '2026-05-29T12:00:00.000Z',
    });
    expect(body.entries[0].email).toBeUndefined();
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_leaderboard',
      expect.objectContaining({ p_tournament_id: 't1' })
    );
  });

  it('clamps page and pageSize', async () => {
    supabaseMock.from.mockImplementation(mockTournamentLookup);
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    await GET(req('?page=-5&pageSize=9999'));
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_leaderboard', {
      p_tournament_id: 't1',
      p_page: 1,
      p_page_size: 100,
      p_search: '',
    });
  });

  it('forwards the search term to the RPC as p_search', async () => {
    let callIdx = 0;
    supabaseMock.from.mockImplementation(() => {
      const handler = callIdx === 0 ? mockTournamentLookup() : mockProfileLookup(false);
      callIdx += 1;
      return handler;
    });
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    await GET(req('?page=1&pageSize=25&search=alice'));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_leaderboard',
      expect.objectContaining({ p_search: 'alice' })
    );
  });

  it('uses get_leaderboard (no email) for an authenticated non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    let callIdx = 0;
    supabaseMock.from.mockImplementation(() => {
      const handler = callIdx === 0 ? mockTournamentLookup() : mockProfileLookup(false);
      callIdx += 1;
      return handler;
    });
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          username: 'alice',
          email: 'alice@example.com',
          points: 100,
          group_points: 60,
          knockout_points: 40,
          total_count: 1,
        },
      ],
      error: null,
    });
    const res = await GET(req());
    const body = await res.json();
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_leaderboard',
      expect.objectContaining({ p_tournament_id: 't1' })
    );
    // Even if the mock leaked an email, the non-admin response must not include it.
    expect(body.entries[0].email).toBeUndefined();
  });

  it('uses admin_get_leaderboard and exposes email when caller is admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin1' } } });
    let callIdx = 0;
    supabaseMock.from.mockImplementation(() => {
      const handler = callIdx === 0 ? mockTournamentLookup() : mockProfileLookup(true);
      callIdx += 1;
      return handler;
    });
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          username: 'alice',
          email: 'alice@example.com',
          points: 100,
          group_points: 60,
          knockout_points: 40,
          total_count: 1,
        },
      ],
      error: null,
    });
    const res = await GET(req());
    const body = await res.json();
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'admin_get_leaderboard',
      expect.objectContaining({ p_tournament_id: 't1' })
    );
    expect(body.entries[0].email).toBe('alice@example.com');
    expect(body.entries[0].username).toBe('alice');
  });
});
