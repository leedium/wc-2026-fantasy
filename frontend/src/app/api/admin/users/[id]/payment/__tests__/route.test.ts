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
const { GET, PATCH } = require('../route');

function patchReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/users/u2/payment', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getReq(qs = '') {
  return new NextRequest(`http://localhost:3000/api/admin/users/u2/payment${qs}`);
}

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    };
  });
}

describe('PATCH /api/admin/users/[id]/payment', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchReq({ tournamentId: 't1', paid: true }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin caller', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await PATCH(patchReq({ tournamentId: 't1', paid: true }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when tournamentId is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({ paid: true }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when paid is not boolean', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({ tournamentId: 't1' }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when paidAt is malformed', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(
      patchReq({ tournamentId: 't1', paid: true, paidAt: 'not-a-date' }),
      { params: Promise.resolve({ id: 'u2' }) }
    );
    expect(res.status).toBe(400);
  });

  it('marks paid (defaults paidAt to null so RPC uses now())', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchReq({ tournamentId: 't1', paid: true }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_payment', {
      p_user_id: 'u2',
      p_tournament_id: 't1',
      p_paid: true,
      p_paid_at: null,
    });
    const body = await res.json();
    expect(body).toEqual({ paid: true, paidAt: null });
  });

  it('passes through paidAt as ISO string', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const iso = '2026-05-01T12:30:00.000Z';
    const res = await PATCH(
      patchReq({ tournamentId: 't1', paid: true, paidAt: iso }),
      { params: Promise.resolve({ id: 'u2' }) }
    );
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_payment', {
      p_user_id: 'u2',
      p_tournament_id: 't1',
      p_paid: true,
      p_paid_at: iso,
    });
  });

  it('marks unpaid', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(
      patchReq({ tournamentId: 't1', paid: false, paidAt: '2026-05-01T00:00:00Z' }),
      { params: Promise.resolve({ id: 'u2' }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ paid: false, paidAt: null });
  });

  it('maps RPC error to 400', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'forbidden' },
    });
    const res = await PATCH(patchReq({ tournamentId: 't1', paid: true }), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('forbidden');
  });
});

describe('GET /api/admin/users/[id]/payment', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(getReq('?tournamentId=t1'), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when tournamentId is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'u2' }) });
    expect(res.status).toBe(400);
  });

  it('returns paid=false when no row exists', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await GET(getReq('?tournamentId=t1'), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ paid: false, paidAt: null, markedBy: null });
  });

  it('returns paid=true with paidAt when a row exists', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { is_admin: true } }) }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { paid_at: '2026-04-29T00:00:00Z', marked_by: 'u1' },
                error: null,
              }),
            }),
          }),
        }),
      };
    });
    const res = await GET(getReq('?tournamentId=t1'), {
      params: Promise.resolve({ id: 'u2' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      paid: true,
      paidAt: '2026-04-29T00:00:00Z',
      markedBy: 'u1',
    });
  });
});
