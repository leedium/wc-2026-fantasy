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
const { GET, POST } = require('../route');

function postRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/predictions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function basePostBody(overrides: Record<string, unknown> = {}) {
  return {
    tournamentId: 't1',
    predictionName: 'Main',
    groups: [],
    knockout: [],
    ...overrides,
  };
}

describe('GET /api/predictions', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 404 when no active tournament', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null }) }),
      }),
    }));
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('returns list-shape with empty predictions array when user has none', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tournaments') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: 't1', lock_time: '' } }) }),
          }),
        };
      }
      if (table === 'predictions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      tournament: { id: 't1' },
      cap: 5,
      predictions: [],
    });
  });
});

describe('POST /api/predictions', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest(basePostBody()));
    expect(res.status).toBe(401);
  });

  it('returns 400 when tournamentId missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await POST(postRequest(basePostBody({ tournamentId: undefined })));
    expect(res.status).toBe(400);
  });

  it('returns 400 when predictionName missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await POST(postRequest(basePostBody({ predictionName: '' })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/predictionName/);
  });

  it('returns 400 when totalGoals out of range', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await POST(postRequest(basePostBody({ totalGoals: 99 })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/0-50/);
  });

  it('returns 403 when rpc reports lock', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'predictions are locked' },
    });
    const res = await POST(postRequest(basePostBody()));
    expect(res.status).toBe(403);
  });

  it('returns 409 when rpc reports limit reached', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'prediction limit reached' },
    });
    const res = await POST(postRequest(basePostBody()));
    expect(res.status).toBe(409);
  });

  it('returns 409 when rpc reports name taken', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'prediction name taken' },
    });
    const res = await POST(postRequest(basePostBody()));
    expect(res.status).toBe(409);
  });

  it('returns 200 with predictionId on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({ data: 'pred-uuid', error: null });
    const res = await POST(postRequest(basePostBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictionId: 'pred-uuid' });
  });
});
