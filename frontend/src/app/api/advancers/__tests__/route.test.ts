/**
 * @jest-environment node
 */
export {};

const supabaseMock = {
  from: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route');

function mockData(
  tournament: { id: string } | null,
  rows: Array<Record<string, unknown>> | null,
  rowsError: { message: string } | null = null
) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'tournaments') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: tournament, error: null }) }),
        }),
      };
    }
    // tournament_advancers: .select(...).eq(...).order(...) is awaited.
    return {
      select: () => ({
        eq: () => ({ order: async () => ({ data: rows, error: rowsError }) }),
      }),
    };
  });
}

describe('GET /api/advancers', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns an empty list when there is no active tournament', async () => {
    mockData(null, null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ advancers: [] });
  });

  it('maps tournament_advancers rows into the camelCase response shape', async () => {
    mockData({ id: 't1' }, [
      { rank: 1, team_id: 'jpn' },
      { rank: 2, team_id: 'mar' },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      advancers: [
        { rank: 1, teamId: 'jpn' },
        { rank: 2, teamId: 'mar' },
      ],
    });
  });

  it('returns 500 when the query errors', async () => {
    mockData({ id: 't1' }, null, { message: 'boom' });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
