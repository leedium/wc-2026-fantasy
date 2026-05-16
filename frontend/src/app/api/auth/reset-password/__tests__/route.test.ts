/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

process.env.RESET_INTENT_SECRET = 'test-secret-must-be-at-least-32-characters-long';

const supabaseMock = {
  auth: {
    getUser: jest.fn(),
    updateUser: jest.fn(),
    signOut: jest.fn(),
  },
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { signResetIntent, RESET_INTENT_COOKIE } = require('@/lib/auth/reset-intent');

function postRequest(body: unknown, cookieValue?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookieValue !== undefined) {
    headers.cookie = `${RESET_INTENT_COOKIE}=${cookieValue}`;
  }
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function validCookieFor(userId: string): string {
  return signResetIntent(userId).value;
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.updateUser.mockReset();
    supabaseMock.auth.signOut.mockReset();
    supabaseMock.auth.signOut.mockResolvedValue({ error: null });
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

  it('returns 401 when no session', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest({ password: 'longenough1' }));
    expect(res.status).toBe(401);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('returns 403 when reset_intent cookie is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await POST(postRequest({ password: 'longenough1' }));
    expect(res.status).toBe(403);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });

  it('returns 403 when reset_intent cookie has tampered HMAC', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const valid = validCookieFor('u1');
    // Flip the last char to break HMAC
    const tampered = valid.slice(0, -1) + (valid.endsWith('A') ? 'B' : 'A');
    const res = await POST(postRequest({ password: 'longenough1' }, tampered));
    expect(res.status).toBe(403);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('returns 403 when reset_intent cookie is for a different user', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const cookieForOther = validCookieFor('u2');
    const res = await POST(postRequest({ password: 'longenough1' }, cookieForOther));
    expect(res.status).toBe(403);
  });

  it('returns 403 when reset_intent cookie is expired', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const realNow = Date.now;
    Date.now = () => realNow() - 1000 * 1000; // 1000 seconds ago — beyond 900s TTL
    const stale = validCookieFor('u1');
    Date.now = realNow;
    const res = await POST(postRequest({ password: 'longenough1' }, stale));
    expect(res.status).toBe(403);
  });

  it('returns 400 when supabase rejects the password', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.auth.updateUser.mockResolvedValue({
      error: { message: 'New password should be different' },
    });
    const res = await POST(postRequest({ password: 'longenough1' }, validCookieFor('u1')));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/should be different/i);
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });

  it('returns 200, signs out, and clears the cookie on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.auth.updateUser.mockResolvedValue({ error: null });
    const res = await POST(postRequest({ password: 'longenough1' }, validCookieFor('u1')));
    expect(res.status).toBe(200);
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'longenough1' });
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ ok: true });
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${RESET_INTENT_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain('max-age=0');
  });
});
