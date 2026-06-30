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
  return new NextRequest('http://localhost:3000/api/admin/predictions/p1/void', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ predictionId: 'p1' }) };

function mockAdminProfile(isAdmin: boolean) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdmin } }) }),
    }),
  }));
}

describe('PATCH /api/admin/predictions/[predictionId]/void', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await PATCH(patchReq({ void: true }), ctx);
    expect(res.status).toBe(403);
  });

  it('forwards admin_set_prediction_void when voiding', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const res = await PATCH(patchReq({ void: true }), ctx);
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_prediction_void', {
      p_prediction_id: 'p1',
      p_void: true,
    });
    expect(await res.json()).toMatchObject({ voided: true });
  });

  it('forwards un-void', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const res = await PATCH(patchReq({ void: false }), ctx);
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_prediction_void', {
      p_prediction_id: 'p1',
      p_void: false,
    });
  });

  it('rejects a non-boolean void', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({ void: 'yes' }), ctx);
    expect(res.status).toBe(400);
  });

  it('maps a not-found RPC error to 404', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'prediction not found' } });
    const res = await PATCH(patchReq({ void: true }), ctx);
    expect(res.status).toBe(404);
  });
});
