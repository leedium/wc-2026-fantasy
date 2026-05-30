/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { PoolStatsBar } from '../PoolStatsBar';

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

describe('PoolStatsBar', () => {
  it('renders the pot total and a per-charity breakdown on a tournament-facing page', async () => {
    mockPathname = '/predictions';
    mockTournamentResponse(1240, 206); // 206 / 2 charities = 103 each
    render(wrap(<PoolStatsBar />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    const bar = screen.getByRole('status');
    expect(bar).toHaveTextContent(/\$1,240/);
    expect(bar).toHaveTextContent('Charity Total:');

    // Each charity's half-share shows (no standalone aggregate $206).
    expect(bar).not.toHaveTextContent(/\$206/);
    expect(screen.getAllByText('$103')).toHaveLength(2);

    // Each logo carries alt text and links to its internal detail page.
    expect(screen.getByAltText('Canadian Cancer Society logo')).toBeInTheDocument();
    expect(screen.getByAltText('Islamic Relief Canada logo')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Canadian Cancer Society: \$103 for charity/ })
    ).toHaveAttribute('href', '/charities/canadian-cancer-society');
    expect(
      screen.getByRole('link', { name: /Islamic Relief Canada: \$103 for charity/ })
    ).toHaveAttribute('href', '/charities/islamic-relief-canada');
  });

  it('shows cents on the per-charity share when the total splits unevenly', async () => {
    mockPathname = '/predictions';
    mockTournamentResponse(210, 35); // 35 / 2 = 17.50 each
    render(wrap(<PoolStatsBar />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getAllByText('$17.50')).toHaveLength(2);
  });

  it('renders on every page for a logged-in user (incl. previously-excluded routes)', async () => {
    mockPathname = '/admin/users/abc';
    mockTournamentResponse(1240, 206);
    render(wrap(<PoolStatsBar />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/\$1,240/);
  });

  it('renders nothing when the user is logged out', () => {
    mockPathname = '/';
    authState.user = null;
    mockTournamentResponse(1240, 206);
    const { container } = render(wrap(<PoolStatsBar />));
    expect(container).toBeEmptyDOMElement();
  });
});
