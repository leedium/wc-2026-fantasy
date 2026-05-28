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
    // knockout_results: .select(...).eq(...) is awaited directly.
    return {
      select: () => ({ eq: async () => ({ data: rows, error: rowsError }) }),
    };
  });
}

describe('GET /api/knockout-results', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns an empty list when there is no active tournament', async () => {
    mockData(null, null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
  });

  it('maps knockout_results rows into the camelCase response shape', async () => {
    mockData({ id: 't1' }, [
      { match_id: 'M73', winner_team_id: 'esp', loser_team_id: 'mar', total_goals: 3 },
      { match_id: 'M104', winner_team_id: 'fra', loser_team_id: 'bra', total_goals: null },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      results: [
        { matchId: 'M73', winnerTeamId: 'esp', loserTeamId: 'mar', totalGoals: 3 },
        { matchId: 'M104', winnerTeamId: 'fra', loserTeamId: 'bra', totalGoals: null },
      ],
    });
  });

  it('returns 500 when the query errors', async () => {
    mockData({ id: 't1' }, null, { message: 'boom' });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
