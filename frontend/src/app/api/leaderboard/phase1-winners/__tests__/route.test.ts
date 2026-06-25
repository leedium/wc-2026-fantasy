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

/**
 * The route hits two tables: `tournaments` (select→eq→maybeSingle) for the active
 * tournament, then `phase1_winners` (select→eq→order) for the rows. Branch the
 * `from` mock on the table name.
 */
function mockTables(opts: {
  tournament: { id: string } | null;
  tournamentError?: unknown;
  winners?: Array<Record<string, unknown>>;
  winnersError?: unknown;
}) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'tournaments') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: opts.tournament,
              error: opts.tournamentError ?? null,
            }),
          }),
        }),
      };
    }
    // phase1_winners
    return {
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: opts.winners ?? [],
            error: opts.winnersError ?? null,
          }),
        }),
      }),
    };
  });
}

describe('GET /api/leaderboard/phase1-winners', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns an empty list when there is no active tournament', async () => {
    mockTables({ tournament: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ winners: [] });
  });

  it('returns an empty list when no snapshot exists', async () => {
    mockTables({ tournament: { id: 't1' }, winners: [] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ winners: [] });
  });

  it('maps snapshot rows into the camelCase shape', async () => {
    mockTables({
      tournament: { id: 't1' },
      winners: [
        {
          rank: 1,
          prediction_id: 'p1',
          prediction_name: 'Lucky Bracket',
          username: 'dave',
          group_points: 110,
          advancer_points: 15.5,
          phase1_points: 125.5,
        },
      ],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      winners: [
        {
          rank: 1,
          predictionId: 'p1',
          predictionName: 'Lucky Bracket',
          username: 'dave',
          groupPoints: 110,
          advancerPoints: 15.5,
          phase1Points: 125.5,
        },
      ],
    });
  });

  it('returns 500 when the winners query errors', async () => {
    mockTables({ tournament: { id: 't1' }, winnersError: { message: 'boom' } });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
