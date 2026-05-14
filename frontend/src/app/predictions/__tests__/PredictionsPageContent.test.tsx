import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { fixtureGroups, fixtureKnockoutMatches, fixtureTeams } from '@/test-utils/fixtures';
import type {
  GroupPrediction,
  KnockoutMatchPrediction,
  Team,
} from '@/types/tournament';

const mockUseQuery = jest.fn();
const mockInvalidate = jest.fn();
const toastSuccess = jest.fn();
const toastError = jest.fn();
const toastInfo = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey: ReadonlyArray<unknown> }) => mockUseQuery(opts),
    useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
  };
});

jest.mock('@/providers/AuthProvider', () => ({
  useAuthContext: () => ({
    user: { id: 'user-1' },
    profile: null,
    loading: false,
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  }),
}));

jest.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

interface GroupStageFormProps {
  predictions: GroupPrediction[];
  onPredictionChange: (
    groupId: string,
    position: 'first' | 'second' | 'third' | 'fourth',
    teamId: string | null
  ) => void;
}
jest.mock('@/components/predictions/GroupStageForm', () => ({
  GroupStageForm: ({ predictions, onPredictionChange }: GroupStageFormProps) => (
    <div data-testid="group-stage-form">
      <span data-testid="groups-filled">
        {predictions.reduce(
          (sum, p) => sum + Object.values(p.positions).filter((v) => v !== null).length,
          0
        )}
      </span>
      <button
        type="button"
        data-testid="fill-all-groups"
        onClick={() => {
          // Fire 48 callbacks (12 groups x 4 positions) using fixture team IDs.
          const positions: Array<'first' | 'second' | 'third' | 'fourth'> = [
            'first',
            'second',
            'third',
            'fourth',
          ];
          predictions.forEach((p) => {
            positions.forEach((pos, i) => {
              onPredictionChange(p.groupId, pos, `${p.groupId.toLowerCase()}-team-${i}`);
            });
          });
        }}
      />
      <button
        type="button"
        data-testid="fill-one-group-position"
        onClick={() =>
          onPredictionChange(predictions[0].groupId, 'first', 'mex')
        }
      />
    </div>
  ),
}));

interface KnockoutBracketProps {
  knockoutPredictions: KnockoutMatchPrediction[];
  onPredictionChange: (matchId: string, winnerId: string | null) => void;
}
jest.mock('@/components/predictions/KnockoutBracket', () => ({
  KnockoutBracket: ({ knockoutPredictions, onPredictionChange }: KnockoutBracketProps) => (
    <div data-testid="knockout-bracket">
      <button
        type="button"
        data-testid="fill-all-knockout"
        onClick={() => {
          knockoutPredictions.forEach((m) => onPredictionChange(m.matchId, 'winner'));
        }}
      />
    </div>
  ),
}));

interface TiebreakerInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
}
jest.mock('@/components/predictions/TiebreakerInput', () => ({
  TiebreakerInput: ({ value, onChange }: TiebreakerInputProps) => (
    <div data-testid="tiebreaker-input">
      <span data-testid="tiebreaker-value">{value ?? 'null'}</span>
      <button
        type="button"
        data-testid="set-tiebreaker"
        onClick={() => onChange(18)}
      />
    </div>
  ),
}));

interface AdvancersFormProps {
  value: Array<{ rank: number; teamId: string }>;
  onRankChange: (rank: number, teamId: string | null) => void;
}
jest.mock('@/components/predictions/AdvancersForm', () => ({
  AdvancersForm: ({ onRankChange }: AdvancersFormProps) => (
    <div data-testid="advancers-form">
      <button
        type="button"
        data-testid="fill-all-bundles"
        onClick={() => {
          // The wizard awaits 8 distinct ranks; the actual team id doesn't
          // matter for navigation tests — the real component + RPC validate
          // team_id is in the prediction's own 3rd-place picks.
          for (let i = 1; i <= 8; i++) onRankChange(i, `team-${i}`);
        }}
      />
    </div>
  ),
}));

import { PredictionsPageContent } from '../PredictionsPageContent';
import { DRAFT_DEBOUNCE_MS, DRAFT_VERSION } from '@/hooks/useDraftPersistence';

const TOURNAMENT_ID = 'tournament-1';
const DRAFT_KEY = `wc2026:draft:user-1:${TOURNAMENT_ID}:new`;

interface QueryConfig {
  tournamentLockTime?: string;
  storedSubmittedAt?: string | null;
  storedGroups?: Array<{
    groupId: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
  }>;
  storedKnockout?: Array<{ matchId: string; winner: string | null }>;
  storedTotalGoals?: number | null;
  phase?: 'phase1' | 'phase1_locked' | 'phase2_open' | 'phase2_locked';
}

function configureQueries({
  tournamentLockTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  storedSubmittedAt = null,
  storedGroups = [],
  storedKnockout = [],
  storedTotalGoals = null,
  phase,
}: QueryConfig = {}) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: ReadonlyArray<unknown> }) => {
    const key = queryKey[0];
    switch (key) {
      case 'tournament':
        return {
          data: {
            id: TOURNAMENT_ID,
            slug: 'wc-2026',
            name: 'World Cup 2026',
            status: 'upcoming',
            lockTime: tournamentLockTime,
            knockoutLockTime: null,
            knockoutUnlocked: phase === 'phase2_open' || phase === 'phase2_locked',
            phase:
              phase ??
              (new Date(tournamentLockTime) > new Date() ? 'phase1' : 'phase1_locked'),
            totalEntries: 0,
            serverTime: new Date().toISOString(),
          },
          isLoading: false,
        };
      case 'groups':
        return { data: fixtureGroups, isLoading: false };
      case 'teams':
        return { data: fixtureTeams as Team[], isLoading: false };
      case 'knockout-matches':
        return { data: fixtureKnockoutMatches, isLoading: false };
      case 'predictions':
        return {
          data: {
            tournamentId: TOURNAMENT_ID,
            totalGoals: storedTotalGoals,
            submittedAt: storedSubmittedAt,
            groups: storedGroups,
            knockout: storedKnockout,
          },
          isLoading: false,
        };
      default:
        return { data: undefined, isLoading: false };
    }
  });
}

beforeEach(() => {
  window.localStorage.clear();
  mockUseQuery.mockReset();
  mockInvalidate.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  toastInfo.mockReset();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PredictionsPageContent — stepper navigation', () => {
  it('disables Continue until the current step is complete', async () => {
    configureQueries();
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    const continueBtn = await screen.findByRole('button', { name: /Continue to Best 3rds/ });
    expect(continueBtn).toBeDisabled();

    await user.click(screen.getByTestId('fill-all-groups'));
    expect(screen.getByRole('button', { name: /Continue to Best 3rds/ })).toBeEnabled();
  });

  it('advances Groups → Best 3rds → Round of 32 via Continue (phase 2 open)', async () => {
    configureQueries({ phase: 'phase2_open' });
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    // In phase 2 the wizard auto-starts on Round of 32; navigate back to
    // Group Stage via the stepper tab to exercise the full Continue chain.
    await user.click(await screen.findByRole('tab', { name: /Group Stage/ }));
    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    // Best 3rds step active.
    expect(screen.getByTestId('advancers-form')).toBeInTheDocument();

    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(screen.getByRole('button', { name: /Continue to Round of 32/ }));

    // Top "Knockout" chip is now current; sub row appears with R32 selected.
    expect(screen.getByRole('tab', { name: /Knockout/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('prediction-substepper')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /R32/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows Save Phase 1 Picks instead of Continue on Best 3rds in phase 1', async () => {
    configureQueries(); // phase 1 default
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));

    // No "Continue to Round of 32" in phase 1.
    expect(
      screen.queryByRole('button', { name: /Continue to Round of 32/ })
    ).not.toBeInTheDocument();
    // The Phase 1 end-of-flow button is shown in its place.
    expect(screen.getByRole('button', { name: /Save Phase 1 Picks/ })).toBeInTheDocument();
    // The Knockout + Tiebreaker top tabs are locked (disabled).
    expect(screen.getByRole('tab', { name: /Knockout/ })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /Tiebreaker/ })).toBeDisabled();
  });

  it('walks through every step with Continue and reaches the tiebreaker (phase 2 open)', async () => {
    configureQueries({ phase: 'phase2_open' });
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    // In phase 2 the wizard auto-starts on Round of 32; navigate back to
    // Group Stage so we can exercise the full Continue chain.
    await user.click(await screen.findByRole('tab', { name: /Group Stage/ }));
    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(screen.getByRole('button', { name: /Continue to Round of 32/ }));
    // Filling all knockout matches at once satisfies every knockout sub-step.
    await user.click(screen.getByTestId('fill-all-knockout'));

    const stages = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final', 'Third Place'];
    for (const next of stages) {
      const btn = await screen.findByRole('button', {
        name: new RegExp(`Continue to ${next}`, 'i'),
      });
      await user.click(btn);
    }
    await user.click(
      await screen.findByRole('button', { name: /Continue to Tiebreaker/ })
    );
    expect(screen.getByTestId('tiebreaker-input')).toBeInTheDocument();
    // Final step shows "Review & submit" instead of "Continue to ...".
    expect(screen.getByRole('button', { name: /Review & submit/ })).toBeInTheDocument();
  });

  it('renders all top stepper triggers as disabled when the tournament is locked', async () => {
    configureQueries({ tournamentLockTime: new Date(Date.now() - 1000).toISOString() });
    render(<PredictionsPageContent mode="create" />);

    await screen.findByText(/Predictions Locked/);
    // Only the top row is rendered when not on a knockout step; assert all top tabs are disabled.
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => expect(tab).toBeDisabled());
  });
});

describe('PredictionsPageContent — autosave', () => {
  it('writes a draft to localStorage after a debounced change', async () => {
    configureQueries();
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<PredictionsPageContent mode="create" />);

    await user.click(await screen.findByTestId('fill-one-group-position'));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(DRAFT_DEBOUNCE_MS);
    });

    const raw = window.localStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.v).toBe(DRAFT_VERSION);
    expect(parsed.data.groupPredictions[0].positions.first).toBe('mex');
  });

  it('hydrates from a localStorage draft for a fresh user', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        v: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        data: {
          groupPredictions: fixtureGroups.map((g, i) => ({
            groupId: g.id,
            positions: {
              first: i === 0 ? 'mex' : null,
              second: null,
              third: null,
              fourth: null,
            },
          })),
          knockoutPredictions: fixtureKnockoutMatches.map((m) => ({
            matchId: m.id,
            winnerId: null,
          })),
          totalGoals: 14,
        },
      })
    );
    configureQueries();

    render(<PredictionsPageContent mode="create" />);

    // Draft has 1 group slot + 1 tiebreaker filled (total 2). Server would have 0.
    await waitFor(() => expect(screen.getByTestId('groups-filled')).toHaveTextContent('1'));
    // Progress bar reflects the combined draft state (groups + tiebreaker).
    expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(
      0
    );
    expect(toastInfo).toHaveBeenCalled();
  });

  it('ignores localStorage draft in edit mode when the prediction has been submitted', async () => {
    const EDIT_DRAFT_KEY = `wc2026:draft:user-1:${TOURNAMENT_ID}:pred-1`;
    window.localStorage.setItem(
      EDIT_DRAFT_KEY,
      JSON.stringify({
        v: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        data: {
          predictionName: 'Drafted',
          groupPredictions: fixtureGroups.map((g) => ({
            groupId: g.id,
            positions: { first: 'mex', second: 'kor', third: null, fourth: null },
          })),
          knockoutPredictions: [],
          totalGoals: 14,
        },
      })
    );
    configureQueries();

    render(
      <PredictionsPageContent
        mode="edit"
        predictionId="pred-1"
        initial={{
          id: 'pred-1',
          name: 'Server',
          totalGoals: 7,
          submittedAt: new Date().toISOString(),
          isPaid: false,
          paidAt: null,
          groups: [{ groupId: 'A', first: 'kor', second: null, third: null, fourth: null }],
          knockout: [],
        }}
      />
    );

    // Server hydration → exactly 1 filled slot. Draft would have been 24.
    await waitFor(() =>
      expect(screen.getByTestId('groups-filled')).toHaveTextContent('1')
    );
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('clears localStorage drafts when the tournament is locked', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        v: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        data: {
          groupPredictions: [],
          knockoutPredictions: [],
          totalGoals: 11,
        },
      })
    );
    configureQueries({ tournamentLockTime: new Date(Date.now() - 1000).toISOString() });

    render(<PredictionsPageContent mode="create" />);

    await screen.findByText(/Predictions Locked/);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clears the draft after a successful submit', async () => {
    // Phase 2 open so Submit is reachable — regular users can't submit in
    // phase 1 (Continue → R32 is replaced by Save Phase 1 Picks).
    configureQueries({ phase: 'phase2_open' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-1' }),
    });
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<PredictionsPageContent mode="create" />);

    // Wizard starts at Round of 32 in phase 2; navigate to Group Stage first.
    await user.click(await screen.findByRole('tab', { name: /Group Stage/ }));
    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(screen.getByRole('button', { name: /Continue to Round of 32/ }));
    await user.click(screen.getByTestId('fill-all-knockout'));
    // Walk through R16 → QF → SF → Final → 3rd → Tiebreaker via Continue.
    for (const next of [
      'Round of 16',
      'Quarter-finals',
      'Semi-finals',
      'Final',
      'Third Place',
      'Tiebreaker',
    ]) {
      await user.click(
        await screen.findByRole('button', {
          name: new RegExp(`Continue to ${next}`, 'i'),
        })
      );
    }
    await user.click(screen.getByTestId('set-tiebreaker'));

    act(() => {
      jest.advanceTimersByTime(DRAFT_DEBOUNCE_MS);
    });
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    // Provide a prediction name (required to submit).
    await user.type(screen.getByLabelText(/Prediction name/), 'Main');

    await user.click(screen.getByRole('button', { name: /Submit Prediction/ }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
