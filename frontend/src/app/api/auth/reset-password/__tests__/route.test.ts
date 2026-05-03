/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  auth: {
    getUser: jest.fn(),
    updateUser: jest.fn(),
  },
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');

function postRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.updateUser.mockReset();
  });

  it('returns 400 when password is too short', async () => {
    const res = await POST(postRequest({ password: 'short' }));
    expect(res.status).toBe(400);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('returns 400 when password missing or non-string', async () => {
    const res = await POST(postRequest({ password: 123 }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when no recovery session', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest({ password: 'longenough1' }));
    expect(res.status).toBe(401);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('returns 400 when supabase rejects the password', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.auth.updateUser.mockResolvedValue({
      error: { message: 'New password should be different' },
    });
    const res = await POST(postRequest({ password: 'longenough1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/should be different/i);
  });

  it('returns 200 ok on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.auth.updateUser.mockResolvedValue({ error: null });
    const res = await POST(postRequest({ password: 'longenough1' }));
    expect(res.status).toBe(200);
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'longenough1' });
    expect(await res.json()).toEqual({ ok: true });
  });
});
