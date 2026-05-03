/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route');

function req(qs = '') {
  return new NextRequest(`http://localhost:3000/api/leaderboard${qs}`);
}

describe('GET /api/leaderboard', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns empty list when no active tournament', async () => {
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }));
    const res = await GET(req('?page=1&pageSize=25'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], total: 0, page: 1, pageSize: 25 });
  });

  it('shapes the RPC result into paginated entries', async () => {
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 't1' } }) }) }),
    }));
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          username: 'alice',
          points: 100,
          group_points: 60,
          knockout_points: 40,
          total_goals: 170,
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
    });
  });

  it('clamps page and pageSize', async () => {
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 't1' } }) }) }),
    }));
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    await GET(req('?page=-5&pageSize=9999'));
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_leaderboard', {
      p_tournament_id: 't1',
      p_page: 1,
      p_page_size: 100,
    });
  });
});
