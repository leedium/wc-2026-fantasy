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
  return new NextRequest('http://localhost:3000/api/auth/change-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/change-email', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.auth.updateUser.mockReset();
  });

  it('returns 400 for an invalid email', async () => {
    const res = await POST(postRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('returns 401 when no session', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest({ email: 'new@example.com' }));
    expect(res.status).toBe(401);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('returns 400 when the new email equals the current email', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'me@example.com' } },
    });
    const res = await POST(postRequest({ email: 'ME@example.com' }));
    expect(res.status).toBe(400);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('returns 409 when the email is already in use', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'me@example.com' } },
    });
    supabaseMock.auth.updateUser.mockResolvedValue({
      error: { message: 'A user with this email address has already been registered' },
    });
    const res = await POST(postRequest({ email: 'taken@example.com' }));
    expect(res.status).toBe(409);
  });

  it('returns 200 and calls updateUser with emailRedirectTo on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'me@example.com' } },
    });
    supabaseMock.auth.updateUser.mockResolvedValue({ error: null });
    const res = await POST(postRequest({ email: 'New@Example.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith(
      { email: 'new@example.com' },
      { emailRedirectTo: 'http://localhost:3000/auth/callback?next=/account' }
    );
  });
});
