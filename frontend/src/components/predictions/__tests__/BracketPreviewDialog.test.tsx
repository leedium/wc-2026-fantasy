import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { BracketPreviewDialog } from '../BracketPreviewDialog';
import { fixtureKnockoutMatches, fixtureTeams } from '@/test-utils/fixtures';

jest.mock('@/lib/api/fetchJSON', () => ({ fetchJSON: jest.fn() }));
jest.mock('@/hooks/useTournamentLock', () => ({ useTournamentLock: jest.fn() }));
jest.mock('@/providers/AuthProvider', () => ({ useAuthContext: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchJSON } = require('@/lib/api/fetchJSON');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useTournamentLock } = require('@/hooks/useTournamentLock');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuthContext } = require('@/providers/AuthProvider');

const prediction = {
  id: 'p1',
  name: 'Main',
  username: 'alice',
  totalGoals: 5,
  championTeamId: null,
  submittedAt: null,
  isPaid: true,
  paidAt: null,
  groups: [],
  knockout: [{ matchId: 'M73', winner: 'mex' }],
  advancers: [],
};

function mockFetch() {
  fetchJSON.mockImplementation((url: string) => {
    if (url === '/api/knockout-matches') return Promise.resolve(fixtureKnockoutMatches);
    if (url === '/api/teams') return Promise.resolve(fixtureTeams);
    if (url === '/api/groups') return Promise.resolve([]);
    if (url === '/api/r32-bracket') return Promise.resolve({ assignments: [] });
    if (url === '/api/group-standings') return Promise.resolve({ standings: [] });
    return Promise.resolve(prediction); // the prediction-detail fetch
  });
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

function renderDialog() {
  render(
    wrap(
      <BracketPreviewDialog
        predictionId="p1"
        apiBasePath="/api/predictions"
        onOpenChange={() => {}}
      />
    )
  );
}

const MSG = /Predictions will be revealed when Phase 2 is locked/i;
const SECTION = 'Phase 2 — Knockout Bracket';

describe('BracketPreviewDialog — knockout seal until Phase 2 locks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch();
    useAuthContext.mockReturnValue({ profile: { isAdmin: false, isSuperAdmin: false } });
  });

  it('seals the knockout bracket with a reveal message before Phase 2 locks', async () => {
    useTournamentLock.mockReturnValue({ phase: 'phase2_open' });
    renderDialog();
    expect(await screen.findByText(MSG)).toBeInTheDocument();
  });

  it('reveals the knockout bracket once Phase 2 is locked', async () => {
    useTournamentLock.mockReturnValue({ phase: 'phase2_locked' });
    renderDialog();
    // Wait until the dialog has loaded (the section title only renders when ready).
    expect(await screen.findByText(SECTION)).toBeInTheDocument();
    expect(screen.queryByText(MSG)).not.toBeInTheDocument();
  });

  it('bypasses the seal for admins', async () => {
    useTournamentLock.mockReturnValue({ phase: 'phase2_open' });
    useAuthContext.mockReturnValue({ profile: { isAdmin: true, isSuperAdmin: false } });
    renderDialog();
    expect(await screen.findByText(SECTION)).toBeInTheDocument();
    expect(screen.queryByText(MSG)).not.toBeInTheDocument();
  });
});
