/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

process.env.RESET_INTENT_SECRET = 'test-secret-must-be-at-least-32-characters-long';

const supabaseMock = {
  auth: {
    verifyOtp: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    signOut: jest.fn(),
  },
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RESET_INTENT_COOKIE } = require('@/lib/auth/reset-intent');

function getRequest(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    supabaseMock.auth.verifyOtp.mockReset();
    supabaseMock.auth.exchangeCodeForSession.mockReset();
    supabaseMock.auth.signOut.mockReset();
    supabaseMock.auth.signOut.mockResolvedValue({ error: null });
  });

  it('sets reset_intent cookie when verifyOtp succeeds for type=recovery', async () => {
    supabaseMock.auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const res = await GET(
      getRequest(
        'http://localhost:3000/auth/callback?token_hash=tok&type=recovery&next=/reset-password'
      )
    );
    expect(res.status).toBe(307);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${RESET_INTENT_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=strict');
  });

  it('signs out and redirects to /login?confirmed=1 when verifyOtp succeeds for type=signup', async () => {
    supabaseMock.auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const res = await GET(
      getRequest(
        'http://localhost:3000/auth/callback?token_hash=tok&type=signup&next=/predictions'
      )
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?confirmed=1');
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
    expect(res.headers.get('set-cookie') ?? '').not.toContain(RESET_INTENT_COOKIE);
  });

  it('sets reset_intent cookie when exchangeCodeForSession succeeds and next=/reset-password', async () => {
    supabaseMock.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const res = await GET(
      getRequest('http://localhost:3000/auth/callback?code=xyz&next=/reset-password')
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('set-cookie') ?? '').toContain(`${RESET_INTENT_COOKIE}=`);
  });

  it('does NOT set reset_intent cookie when exchangeCodeForSession succeeds and next is not /reset-password', async () => {
    supabaseMock.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const res = await GET(
      getRequest('http://localhost:3000/auth/callback?code=xyz&next=/predictions')
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('set-cookie') ?? '').not.toContain(RESET_INTENT_COOKIE);
  });

  it('redirects to login on confirmation failure', async () => {
    const res = await GET(getRequest('http://localhost:3000/auth/callback'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?error=confirmation_failed');
  });
});
