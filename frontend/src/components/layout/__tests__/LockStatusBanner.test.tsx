/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { LockStatusBanner } from '../LockStatusBanner';

const mockProfile = { isSuperAdmin: false };
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: mockProfile }),
}));

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  window.sessionStorage.clear();
  mockProfile.isSuperAdmin = false;
});

function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockTournament({
  lockOffsetMs,
  serverOffsetMs = 0,
}: {
  lockOffsetMs: number;
  serverOffsetMs?: number;
}) {
  const lockTime = new Date(Date.now() + lockOffsetMs).toISOString();
  const serverTime = new Date(Date.now() + serverOffsetMs).toISOString();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 't1',
      slug: 'wc',
      name: 'WC',
      status: 'upcoming',
      lockTime,
      totalEntries: 0,
      serverTime,
    }),
  }) as unknown as typeof fetch;
}

describe('LockStatusBanner', () => {
  it('renders nothing while tournament data is loading', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(wrap(<LockStatusBanner />));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an open countdown when far from lock', async () => {
    mockTournament({ lockOffsetMs: 7 * 24 * 60 * 60 * 1000 });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/Predictions lock in/);
    expect(screen.getByRole('status').className).toContain('bg-green-600');
  });

  it('renders the urgent (amber) state inside the final 24 hours', async () => {
    mockTournament({ lockOffsetMs: 60_000 });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status').className).toContain('bg-amber-600');
  });

  it('renders the locked state when lock is in the past', async () => {
    mockTournament({ lockOffsetMs: -60_000 });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/locked/i);
    expect(screen.getByRole('status').className).toContain('bg-red-600');
  });

  it('shows the super-admin chip when locked + super admin', async () => {
    mockProfile.isSuperAdmin = true;
    mockTournament({ lockOffsetMs: -60_000 });
    render(wrap(<LockStatusBanner />));
    await waitFor(() =>
      expect(screen.getByText(/Super admin: edits still open/i)).toBeInTheDocument()
    );
  });

  it('shows the clock-skew caption when the device clock is off > 5 minutes', async () => {
    mockTournament({ lockOffsetMs: 86_400_000, serverOffsetMs: 10 * 60 * 1000 });
    render(wrap(<LockStatusBanner />));
    await waitFor(() =>
      expect(screen.getByText(/device clock looks off/i)).toBeInTheDocument()
    );
  });

  it('persists dismiss in sessionStorage', async () => {
    mockTournament({ lockOffsetMs: 86_400_000 });
    const user = userEvent.setup();
    const { unmount } = render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Mounting again with the same tournament + same locked-flag stays dismissed.
    unmount();
    render(wrap(<LockStatusBanner />));
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
