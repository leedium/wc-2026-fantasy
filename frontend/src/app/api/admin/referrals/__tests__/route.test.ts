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
const { GET, POST, DELETE } = require('../route');

function mockAdmin(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

function getReq(qs = '') {
  return new NextRequest(`http://localhost:3000/api/admin/referrals${qs}`);
}

function bodyReq(method: string, body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/referrals', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  supabaseMock.auth.getUser.mockReset();
  supabaseMock.from.mockReset();
  supabaseMock.rpc.mockReset();
});

describe('GET /api/admin/referrals', () => {
  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(getReq('?userId=u1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(false);
    const res = await GET(getReq('?userId=u1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when userId missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it('shapes overview, referees, inbound, and audit', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockImplementation((fn: string) => {
      if (fn === 'admin_referral_overview') {
        return Promise.resolve({
          data: [
            {
              referral_code: 'ABCDEFGH',
              qualified_total: 4,
              earned_credits: 1,
              redeemed_total: 0,
              available_credits: 1,
              referee_count: 5,
            },
          ],
          error: null,
        });
      }
      if (fn === 'admin_list_user_referrals') {
        return Promise.resolve({
          data: [
            {
              direction: 'outbound',
              referee_id: 'r1',
              referee_username: 'ref1',
              referee_email: 'ref1@x.co',
              referrer_id: 'a',
              referrer_username: 'me',
              referrer_email: 'me@x.co',
              referrer_code_used: 'ADMIN',
              source: 'admin',
              has_paid: true,
              created_at: '2026-05-01T00:00:00Z',
              qualified_at: '2026-05-02T00:00:00Z',
            },
            {
              direction: 'inbound',
              referee_id: 'a',
              referee_username: 'me',
              referee_email: 'me@x.co',
              referrer_id: 'b',
              referrer_username: 'boss',
              referrer_email: 'boss@x.co',
              referrer_code_used: 'XYZ12345',
              source: 'organic',
              has_paid: true,
              created_at: '2026-04-01T00:00:00Z',
              qualified_at: null,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({
        data: [
          {
            id: 'aud1',
            actor_username: 'admin',
            action: 'add',
            referrer_username: 'me',
            referee_username: 'ref1',
            referee_email: 'ref1@x.co',
            note: 'proof',
            created_at: '2026-05-01T00:00:00Z',
          },
        ],
        error: null,
      });
    });

    const res = await GET(getReq('?userId=a'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview).toMatchObject({ availableCredits: 1, refereeCount: 5 });
    expect(body.referees).toHaveLength(1);
    expect(body.referees[0]).toMatchObject({ refereeUsername: 'ref1', source: 'admin' });
    expect(body.inbound).toMatchObject({ referrerUsername: 'boss' });
    expect(body.audit).toHaveLength(1);
    expect(body.audit[0]).toMatchObject({ action: 'add', note: 'proof' });
  });
});

describe('POST /api/admin/referrals', () => {
  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(false);
    const res = await POST(
      bodyReq('POST', { referrerId: 'a', refereeEmail: 'x@y.co', note: 'n' })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when note missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    const res = await POST(bodyReq('POST', { referrerId: 'a', refereeEmail: 'x@y.co' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when referee account not found', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'referee account not found' },
    });
    const res = await POST(
      bodyReq('POST', { referrerId: 'a', refereeEmail: 'x@y.co', note: 'n' })
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when already referred', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'referee already referred' },
    });
    const res = await POST(
      bodyReq('POST', { referrerId: 'a', refereeEmail: 'x@y.co', note: 'n' })
    );
    expect(res.status).toBe(409);
  });

  it('returns 201 with qualified flag on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({
      data: [{ referee_id: 'r1', qualified: true }],
      error: null,
    });
    const res = await POST(
      bodyReq('POST', { referrerId: 'a', refereeEmail: 'x@y.co', note: 'proof' })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ refereeId: 'r1', qualified: true });
  });
});

describe('DELETE /api/admin/referrals', () => {
  it('returns 400 when refereeId missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    const res = await DELETE(bodyReq('DELETE', { note: 'n' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when referral not found', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'referral not found' } });
    const res = await DELETE(bodyReq('DELETE', { refereeId: 'r1', note: 'n' }));
    expect(res.status).toBe(404);
  });

  it('returns ok on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({ error: null });
    const res = await DELETE(bodyReq('DELETE', { refereeId: 'r1', note: 'proof' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
