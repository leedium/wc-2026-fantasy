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
const { GET } = require('../route');

function req(qs = '') {
  return new NextRequest(`http://localhost:3000/api/admin/messages/recipients${qs}`);
}

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }) }),
  }));
}

describe('GET /api/admin/messages/recipients', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('returns the recipient count for all users', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: [{ email: 'a@x.com' }, { email: 'b@x.com' }],
      error: null,
    });
    const res = await GET(req('?paidOnly=false'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: 2, paidOnly: false });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_list_recipient_emails', {
      p_paid_only: false,
    });
  });

  it('passes paidOnly=true through to the RPC', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: [{ email: 'a@x.com' }], error: null });
    const res = await GET(req('?paidOnly=true'));
    const body = await res.json();
    expect(body).toEqual({ count: 1, paidOnly: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_list_recipient_emails', {
      p_paid_only: true,
    });
  });
});
