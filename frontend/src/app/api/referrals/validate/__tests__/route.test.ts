/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const supabaseMock = {
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: async () => supabaseMock,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('../route');

function get(code?: string) {
  const url = new URL('http://localhost/api/referrals/validate');
  if (code !== undefined) url.searchParams.set('code', code);
  return new NextRequest(url);
}

describe('GET /api/referrals/validate', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
  });

  it('returns { valid: false } and skips the DB when code is missing', async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed codes without calling the RPC', async () => {
    const res = await GET(get('not-a-code'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('uppercases and trims valid codes before resolving', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'leedium', error: null });
    // 'AbcdJkmn' — 8 chars, all in the unambiguous alphabet after upcasing
    // (no 0/O/1/I/L). Mixed case + surrounding whitespace exercises both
    // the trim() and the toUpperCase() in the route.
    const res = await GET(get('  AbcdJkmn  '));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, referrerUsername: 'leedium' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('resolve_referrer_username', {
      p_code: 'ABCDJKMN',
    });
  });

  it('returns invalid when the RPC resolves to null', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const res = await GET(get('ABCDEFGH'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false });
  });

  it('returns invalid (never 500) when the DB errors — no info leak', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'something internal' },
    });
    const res = await GET(get('ABCDEFGH'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false });
  });
});
