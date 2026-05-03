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

  it('returns empty predictions shape when user has none', async () => {
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
            eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          }),
        };
      }
      return {};
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ tournamentId: 't1', groups: [], knockout: [] });
  });
});

describe('POST /api/predictions', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest({ tournamentId: 't1', groups: [], knockout: [] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when tournamentId missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await POST(postRequest({ groups: [], knockout: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when totalGoals out of range', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await POST(
      postRequest({ tournamentId: 't1', totalGoals: 99, groups: [], knockout: [] })
    );
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
    const res = await POST(postRequest({ tournamentId: 't1', groups: [], knockout: [] }));
    expect(res.status).toBe(403);
  });

  it('returns 200 with predictionId on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({ data: 'pred-uuid', error: null });
    const res = await POST(postRequest({ tournamentId: 't1', groups: [], knockout: [] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictionId: 'pred-uuid' });
  });
});
