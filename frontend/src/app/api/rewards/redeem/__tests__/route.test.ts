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

function postRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/rewards/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/rewards/redeem', () => {
  beforeEach(() => {
    supabaseMock.auth.getUser.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest({ predictionId: 'p1' }));
    expect(res.status).toBe(401);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 400 when predictionId is missing', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 200 with paymentId + source=referral on successful referral redemption', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: [{ payment_id: 'pay-1', source: 'referral' }],
      error: null,
    });

    const res = await POST(postRequest({ predictionId: 'p1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ paymentId: 'pay-1', source: 'referral' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('redeem_free_pick', {
      p_prediction_id: 'p1',
    });
  });

  it('returns 200 with paymentId + source=loyalty on successful loyalty redemption', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({
      data: [{ payment_id: 'pay-2', source: 'loyalty' }],
      error: null,
    });

    const res = await POST(postRequest({ predictionId: 'p2' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ paymentId: 'pay-2', source: 'loyalty' });
  });

  it.each([
    ['not your prediction', 403],
    ['predictions are locked', 403],
    ['prediction not found', 404],
    ['no free picks available', 409],
    ['no referral credits available', 409],
    ['no loyalty credits available', 409],
    ['prediction already paid', 409],
  ])('maps %s → %i', async (message, status) => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message } });

    const res = await POST(postRequest({ predictionId: 'p1' }));
    expect(res.status).toBe(status);
  });
});
