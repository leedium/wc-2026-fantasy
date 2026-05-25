/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { PoolStatsBar, isPoolStatsVisiblePath } from '../PoolStatsBar';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const authState: { user: { id: string } | null; loading: boolean } = {
  user: { id: 'u1' },
  loading: false,
};
jest.mock('@/providers/AuthProvider', () => ({
  useAuthContext: () => authState,
}));

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  mockPathname = '/';
  authState.user = { id: 'u1' };
  authState.loading = false;
});

function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockTournamentResponse(potTotalCAD: number, charityTotalCAD: number) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ potTotalCAD, charityTotalCAD }),
  }) as unknown as typeof fetch;
}

describe('isPoolStatsVisiblePath', () => {
  it.each([
    ['/', true],
    ['/predictions', true],
    ['/predictions/abc-123', true],
    ['/leaderboard', true],
    ['/rules', true],
    ['/charities', true],
    ['/charities/canadian-cancer-society', true],
    ['/rewards', true],
    ['/referrals', true],
    ['/admin', false],
    ['/admin/users/123', false],
    ['/account', false],
    ['/login', false],
    ['/register', false],
    ['/about', false],
    ['/terms', false],
    ['/privacy', false],
    ['/forgot-password', false],
    ['/reset-password', false],
    ['/auth/callback', false],
  ])('pathname %s → %s', (path, expected) => {
    expect(isPoolStatsVisiblePath(path)).toBe(expected);
  });
});

describe('PoolStatsBar', () => {
  it('renders pot and charity totals on a tournament-facing page', async () => {
    mockPathname = '/predictions';
    mockTournamentResponse(1240, 206);
    render(wrap(<PoolStatsBar />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    const bar = screen.getByRole('status');
    expect(bar).toHaveTextContent(/\$1,240/);
    expect(bar).toHaveTextContent(/\$206/);
  });

  it('renders nothing on an admin route', () => {
    mockPathname = '/admin/users/abc';
    mockTournamentResponse(1240, 206);
    const { container } = render(wrap(<PoolStatsBar />));
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders nothing on /account', () => {
    mockPathname = '/account';
    mockTournamentResponse(1240, 206);
    const { container } = render(wrap(<PoolStatsBar />));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the user is logged out, even on a visible path', () => {
    mockPathname = '/';
    authState.user = null;
    mockTournamentResponse(1240, 206);
    const { container } = render(wrap(<PoolStatsBar />));
    expect(container).toBeEmptyDOMElement();
  });
});
