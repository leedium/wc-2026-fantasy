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
  phase,
  knockoutLockTime = null,
}: {
  lockOffsetMs: number;
  serverOffsetMs?: number;
  phase?: 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';
  knockoutLockTime?: string | null;
}) {
  const lockTime = new Date(Date.now() + lockOffsetMs).toISOString();
  const serverTime = new Date(Date.now() + serverOffsetMs).toISOString();
  // If the test didn't specify a phase, infer it from the lock offset:
  //   future lock → phase1, past lock + no knockout unlock → phase1_locked.
  const inferredPhase: 'phase1' | 'phase1_locked' = lockOffsetMs > 0 ? 'phase1' : 'phase1_locked';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 't1',
      slug: 'wc',
      name: 'WC',
      status: 'upcoming',
      lockTime,
      knockoutLockTime,
      knockoutUnlocked: false,
      phase: phase ?? inferredPhase,
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
    expect(screen.getByRole('status')).toHaveTextContent(/left to choose/i);
    expect(screen.getByRole('status').className).toContain('bg-green-600');
  });

  it('renders the urgent (amber) state inside the final 24 hours', async () => {
    mockTournament({ lockOffsetMs: 60_000 });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status').className).toContain('bg-amber-600');
  });

  it('renders the between-phases state when phase 1 has ended and phase 2 not yet opened', async () => {
    mockTournament({ lockOffsetMs: -60_000 });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/Group stage in progress/i);
    expect(screen.getByRole('status')).toHaveTextContent(/knockout bracket is determined/i);
    expect(screen.getByRole('status').className).toContain('bg-slate-600');
  });

  it('stays in the between-phases state when advancers are posted but phase 2 never opened', async () => {
    // Regression: posting best-3rd advancers mid-group-stage must NOT trip the
    // "knockout has begun" message. The only signal that matters is whether
    // Phase 2 was ever opened (knockoutLockTime non-null).
    mockTournament({ lockOffsetMs: -60_000, phase: 'phase1_locked', knockoutLockTime: null });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/Group stage in progress/i);
    expect(screen.getByRole('status')).not.toHaveTextContent(/knockout stage has begun/i);
    expect(screen.getByRole('status').className).toContain('bg-slate-600');
  });

  it('renders the knockout-stage message when phase 2 was opened and then closed by admin', async () => {
    // Manual close reverts the phase to phase1_locked but leaves knockoutLockTime set.
    const knockoutLockTime = new Date(Date.now() - 30_000).toISOString();
    mockTournament({ lockOffsetMs: -60_000, phase: 'phase1_locked', knockoutLockTime });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/knockout stage has begun/i);
    expect(screen.getByRole('status')).not.toHaveTextContent(/Group stage in progress/i);
    expect(screen.getByRole('status').className).toContain('bg-red-600');
  });

  it('renders the fully locked state when phase 2 has closed', async () => {
    mockTournament({ lockOffsetMs: -60_000, phase: 'phase2_locked' });
    render(wrap(<LockStatusBanner />));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/knockout stage has begun/i);
    expect(screen.getByRole('status').className).toContain('bg-red-600');
  });

  it('shows the super-admin chip when locked + super admin', async () => {
    mockProfile.isSuperAdmin = true;
    mockTournament({ lockOffsetMs: -60_000, phase: 'phase2_locked' });
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
