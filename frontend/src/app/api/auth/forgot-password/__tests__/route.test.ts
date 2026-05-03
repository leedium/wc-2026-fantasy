/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const serverSupabase = {
  auth: { resetPasswordForEmail: jest.fn() },
};

const adminSupabase = {
  from: jest.fn(),
  auth: { admin: { getUserById: jest.fn() } },
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => serverSupabase,
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => adminSupabase,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');

function postRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockProfileLookup(profile: { id: string } | null) {
  adminSupabase.from.mockImplementation((table: string) => {
    if (table !== 'profiles') throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: profile }) }),
      }),
    };
  });
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    serverSupabase.auth.resetPasswordForEmail.mockReset();
    adminSupabase.from.mockReset();
    adminSupabase.auth.admin.getUserById.mockReset();
    serverSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  });

  it('always returns 200 ok:true', async () => {
    const res = await POST(postRequest({ identifier: '' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('calls resetPasswordForEmail directly when identifier is an email', async () => {
    const res = await POST(postRequest({ identifier: 'Alice@Example.com' }));
    expect(res.status).toBe(200);
    expect(serverSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({
        redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
      })
    );
    expect(adminSupabase.from).not.toHaveBeenCalled();
  });

  it('looks up email by username and resets when found', async () => {
    mockProfileLookup({ id: 'user-1' });
    adminSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: 'alice@example.com' } },
    });

    const res = await POST(postRequest({ identifier: 'alice' }));
    expect(res.status).toBe(200);
    expect(adminSupabase.auth.admin.getUserById).toHaveBeenCalledWith('user-1');
    expect(serverSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'alice@example.com',
      expect.any(Object)
    );
  });

  it('returns 200 silently when username does not exist', async () => {
    mockProfileLookup(null);
    const res = await POST(postRequest({ identifier: 'ghost' }));
    expect(res.status).toBe(200);
    expect(adminSupabase.auth.admin.getUserById).not.toHaveBeenCalled();
    expect(serverSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('returns 200 silently when username fails regex', async () => {
    const res = await POST(postRequest({ identifier: 'no' })); // too short
    expect(res.status).toBe(200);
    expect(adminSupabase.from).not.toHaveBeenCalled();
    expect(serverSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('returns 200 silently for non-string identifier', async () => {
    const res = await POST(postRequest({ identifier: 123 }));
    expect(res.status).toBe(200);
    expect(serverSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('returns 200 silently for over-long identifier', async () => {
    const res = await POST(postRequest({ identifier: 'a'.repeat(300) }));
    expect(res.status).toBe(200);
    expect(serverSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
