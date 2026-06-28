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
const { PATCH } = require('../route');

function patchReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/knockout-matches/M73/lock', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ matchId: 'M73' }) };

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

describe('PATCH /api/admin/knockout-matches/[matchId]/lock', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await PATCH(patchReq({ tournamentId: 't1', lockedAt: null }), ctx);
    expect(res.status).toBe(403);
  });

  it('returns 400 when tournamentId is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({ lockedAt: null }), ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when lockedAt key is omitted', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({ tournamentId: 't1' }), ctx);
    expect(res.status).toBe(400);
  });

  it('forwards a lock time to the rpc', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const iso = '2026-06-28T19:00:00.000Z';
    const res = await PATCH(patchReq({ tournamentId: 't1', lockedAt: iso }), ctx);
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_knockout_match_lock', {
      p_tournament_id: 't1',
      p_match_id: 'M73',
      p_locked_at: iso,
    });
  });

  it('forwards null (unlock) to the rpc', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchReq({ tournamentId: 't1', lockedAt: null }), ctx);
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_knockout_match_lock', {
      p_tournament_id: 't1',
      p_match_id: 'M73',
      p_locked_at: null,
    });
  });
});
