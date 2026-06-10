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

  it('defaults to the "all" segment and returns the count', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: [{ email: 'a@x.com' }, { email: 'b@x.com' }],
      error: null,
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: 2, segment: 'all' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_list_recipient_emails', { p_segment: 'all' });
  });

  it.each(['paid', 'unpaid', 'no_prediction'])('passes the %s segment to the RPC', async (segment) => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: [{ email: 'a@x.com' }], error: null });
    const res = await GET(req(`?segment=${segment}`));
    const body = await res.json();
    expect(body).toEqual({ count: 1, segment });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_list_recipient_emails', { p_segment: segment });
  });

  it('falls back to "all" for an unknown segment', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    const res = await GET(req('?segment=bogus'));
    const body = await res.json();
    expect(body.segment).toBe('all');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_list_recipient_emails', { p_segment: 'all' });
  });
});
