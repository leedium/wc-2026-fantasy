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
  return new NextRequest('http://localhost:3000/api/admin/predictions/p1/payment', {
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

describe('PATCH /api/admin/predictions/[predictionId]/payment', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 403 for non-admin', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(false);
    const res = await PATCH(patchReq({ paid: true }), ctx);
    expect(res.status).toBe(403);
  });

  it('forwards p_is_free=false by default when marking paid', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const res = await PATCH(patchReq({ paid: true, paidAt: '2026-06-01T00:00:00Z' }), ctx);
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_prediction_payment', {
      p_prediction_id: 'p1',
      p_paid: true,
      p_paid_at: '2026-06-01T00:00:00.000Z',
      p_is_free: false,
    });
    const body = await res.json();
    expect(body).toMatchObject({ paid: true, isFree: false });
  });

  it('forwards p_is_free=true when marking free', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const res = await PATCH(
      patchReq({ paid: true, paidAt: '2026-06-01T00:00:00Z', isFree: true }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_prediction_payment', {
      p_prediction_id: 'p1',
      p_paid: true,
      p_paid_at: '2026-06-01T00:00:00.000Z',
      p_is_free: true,
    });
    const body = await res.json();
    expect(body).toMatchObject({ paid: true, isFree: true });
  });

  it('maps a forbidden RPC error to 403 (non-super-admin attempting free)', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'forbidden' } });

    const res = await PATCH(patchReq({ paid: true, isFree: true }), ctx);
    expect(res.status).toBe(403);
  });

  it('rejects a non-boolean isFree', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAdminProfile(true);
    const res = await PATCH(patchReq({ paid: true, isFree: 'yes' }), ctx);
    expect(res.status).toBe(400);
  });
});
