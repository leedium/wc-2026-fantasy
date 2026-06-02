/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const maybeSingle = jest.fn();
const supabaseMock = {
  auth: {
    getUser: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ maybeSingle })),
    })),
  })),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');

function postRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/account/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.signOut.mockReset();
    supabaseMock.auth.signOut.mockResolvedValue({ error: null });
    supabaseMock.rpc.mockReset();
    maybeSingle.mockReset();
  });

  it('returns 401 when no session', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest({ confirmUsername: 'alice' }));
    expect(res.status).toBe(401);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 400 when the typed username does not match', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    maybeSingle.mockResolvedValue({ data: { username: 'alice' } });
    const res = await POST(postRequest({ confirmUsername: 'bob' }));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 409 when the account has paid entries', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    maybeSingle.mockResolvedValue({ data: { username: 'alice' } });
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'account has paid entries' } });
    const res = await POST(postRequest({ confirmUsername: 'alice' }));
    expect(res.status).toBe(409);
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });

  it('returns 403 when an admin tries to self-delete', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    maybeSingle.mockResolvedValue({ data: { username: 'alice' } });
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'cannot delete admin account' } });
    const res = await POST(postRequest({ confirmUsername: 'alice' }));
    expect(res.status).toBe(403);
  });

  it('returns 200, calls the RPC, and signs out on success (case-insensitive match)', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    maybeSingle.mockResolvedValue({ data: { username: 'Alice' } });
    supabaseMock.rpc.mockResolvedValue({ error: null });
    const res = await POST(postRequest({ confirmUsername: 'alice' }));
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_own_account');
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ ok: true });
  });
});
