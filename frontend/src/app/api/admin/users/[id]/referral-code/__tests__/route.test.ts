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

function mockAdmin(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

function patchReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/users/u1/referral-code', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: 'u1' }) };

beforeEach(() => {
  supabaseMock.auth.getUser.mockReset();
  supabaseMock.from.mockReset();
  supabaseMock.rpc.mockReset();
});

describe('PATCH /api/admin/users/[id]/referral-code', () => {
  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchReq({ code: 'GIUSEPPETHEMC', note: 'vip' }), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(false);
    const res = await PATCH(patchReq({ code: 'GIUSEPPETHEMC', note: 'vip' }), ctx);
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid code format before hitting the RPC', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    const res = await PATCH(patchReq({ code: 'AB', note: 'vip' }), ctx);
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 400 when the note is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    const res = await PATCH(patchReq({ code: 'GIUSEPPETHEMC', note: '  ' }), ctx);
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('maps the RPC super-admin gate to 403', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'forbidden' } });
    const res = await PATCH(patchReq({ code: 'GIUSEPPETHEMC', note: 'vip' }), ctx);
    expect(res.status).toBe(403);
  });

  it('maps user-not-found to 404', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'user not found' } });
    const res = await PATCH(patchReq({ code: 'GIUSEPPETHEMC', note: 'vip' }), ctx);
    expect(res.status).toBe(404);
  });

  it('maps code-already-in-use to 409', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'code already in use' } });
    const res = await PATCH(patchReq({ code: 'GIUSEPPETHEMC', note: 'vip' }), ctx);
    expect(res.status).toBe(409);
  });

  it('uppercases the code and calls the RPC on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
    mockAdmin(true);
    supabaseMock.rpc.mockResolvedValue({ error: null });
    const res = await PATCH(patchReq({ code: 'giuseppethemc', note: 'vip influencer' }), ctx);
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_referral_code', {
      p_user_id: 'u1',
      p_code: 'GIUSEPPETHEMC',
      p_note: 'vip influencer',
    });
    const json = await res.json();
    expect(json.code).toBe('GIUSEPPETHEMC');
  });
});
