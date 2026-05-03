/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const getUserMock = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
  }),
}));

// Import after mock so env and module init succeed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { middleware } = require('../middleware');

function makeRequest(pathname: string) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

describe('middleware', () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it('redirects unauthenticated users from /predictions to /login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await middleware(makeRequest('/predictions'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fpredictions');
  });

  it('allows authenticated users through /predictions', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'abc' } } });
    const res = await middleware(makeRequest('/predictions'));
    expect(res.status).toBe(200);
  });

  it('passes through public routes even when signed out', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await middleware(makeRequest('/leaderboard'));
    expect(res.status).toBe(200);
  });

  it('redirects unauthenticated users from /admin to /login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await middleware(makeRequest('/admin/users'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fadmin%2Fusers');
  });
});
