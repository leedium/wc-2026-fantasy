/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const updateMock = jest.fn();
const eqMock = jest.fn();
const fromMock = jest.fn(() => ({ update: updateMock }));

const supabaseMock = {
  auth: {
    getUser: jest.fn(),
  },
  from: fromMock,
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PATCH } = require('../route');

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  supabaseMock.auth.getUser.mockReset();
  fromMock.mockClear();
  updateMock.mockReset();
  eqMock.mockReset();
  // Default: authenticated as user-1, DB update succeeds
  supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  eqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: eqMock });
});

describe('PATCH /api/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await PATCH(patchRequest({ username: 'David_test' }));
    expect(res.status).toBe(401);
  });

  it('updates username and displayName=null, scoped to the caller', async () => {
    const res = await PATCH(patchRequest({ username: 'David_test', displayName: null }));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(updateMock).toHaveBeenCalledWith({ username: 'David_test', display_name: null });
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1');
  });

  it('rejects invalid usernames', async () => {
    const res = await PATCH(patchRequest({ username: 'no spaces' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'username invalid format' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when no fields are provided', async () => {
    const res = await PATCH(patchRequest({}));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('maps duplicate-username DB errors to 409', async () => {
    eqMock.mockResolvedValueOnce({
      error: { message: 'duplicate key value violates unique constraint "profiles_username_key"' },
    });
    const res = await PATCH(patchRequest({ username: 'Taken' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'username taken' });
  });

  it('regression: permission-denied (missing UPDATE grant) surfaces as 400, not 500', async () => {
    // Before migration 0033, PostgREST returned this exact error because
    // public.profiles had no UPDATE grant. Asserting we at least don't 5xx
    // — the migration is the real fix; this guards against future grant
    // regressions on the same table.
    eqMock.mockResolvedValueOnce({
      error: { message: 'permission denied for table profiles' },
    });
    const res = await PATCH(patchRequest({ username: 'David_test' }));
    expect(res.status).toBe(400);
  });
});
