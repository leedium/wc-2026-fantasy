/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  auth: { getUser: jest.fn() },
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route');

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req() {
  return new NextRequest('http://localhost/api/predictions/p1/redeem-credit', {
    method: 'POST',
  });
}

describe('POST /api/predictions/[id]/redeem-credit', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req(), ctx('p1'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with paymentId on success', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({ data: 'pay-1', error: null });
    const res = await POST(req(), ctx('p1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ paymentId: 'pay-1' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('redeem_referral_credit', {
      p_prediction_id: 'p1',
    });
  });

  it('maps "not your prediction" → 403', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'not your prediction' },
    });
    const res = await POST(req(), ctx('p1'));
    expect(res.status).toBe(403);
  });

  it('maps "predictions are locked" → 403', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'predictions are locked' },
    });
    const res = await POST(req(), ctx('p1'));
    expect(res.status).toBe(403);
  });

  it('maps "prediction not found" → 404', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'prediction not found' },
    });
    const res = await POST(req(), ctx('p1'));
    expect(res.status).toBe(404);
  });

  it('maps "no referral credits available" → 409', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'no referral credits available' },
    });
    const res = await POST(req(), ctx('p1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('no referral credits available');
  });

  it('maps "prediction already paid" → 409', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'prediction already paid' },
    });
    const res = await POST(req(), ctx('p1'));
    expect(res.status).toBe(409);
  });
});
