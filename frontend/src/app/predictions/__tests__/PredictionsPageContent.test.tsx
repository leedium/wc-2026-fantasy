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

// Per-test override for the AuthProvider mock. Defaults to a logged-in
// non-admin user; individual tests flip isSuperAdmin to exercise the
// super-admin lock bypass on the wizard's navigation.
let mockAuthProfile: { isSuperAdmin?: boolean } | null = null;

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
    profile: mockAuthProfile,
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
          // Fill every knockout match including M103 (third-place playoff),
          // which is a required, scored round again.
          knockoutPredictions.forEach((m) => onPredictionChange(m.matchId, 'winner'));
        }}
      />
      <button
        type="button"
        data-testid="fill-all-knockout-except-third"
        onClick={() => {
          // Fill everything except M103 — used to assert the third-place
          // round gates bracket completion.
          knockoutPredictions
            .filter((m) => m.matchId !== 'M103')
            .forEach((m) => onPredictionChange(m.matchId, 'winner'));
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

interface ChampionPickFormProps {
  value: string | null;
  onChange: (teamId: string | null) => void;
}
jest.mock('@/components/predictions/ChampionPickForm', () => ({
  ChampionPickForm: ({ value, onChange }: ChampionPickFormProps) => (
    <div data-testid="champion-pick-form">
      <span data-testid="champion-value">{value ?? 'null'}</span>
      <button
        type="button"
        data-testid="fill-champion"
        onClick={() => onChange('team-arg')}
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
  mockAuthProfile = null;
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

  it('advances Groups → Best 3rds → Gut Feeling Champion → Round of 32 via Continue (phase 2 open)', async () => {
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
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );
    expect(screen.getByTestId('champion-pick-form')).toBeInTheDocument();
    await user.click(screen.getByTestId('fill-champion'));
    await user.click(screen.getByRole('button', { name: /Continue to Round of 32/ }));

    // Top "Knockout" chip is now current; sub row appears with R32 selected.
    expect(screen.getByRole('tab', { name: /Knockout/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('prediction-substepper')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /R32/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows Save Phase 1 Picks on the Gut Feeling Champion step in phase 1', async () => {
    configureQueries(); // phase 1 default
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );
    await user.click(screen.getByTestId('fill-champion'));

    // No "Continue to Round of 32" in phase 1 — knockout is locked for
    // regular users.
    expect(
      screen.queryByRole('button', { name: /Continue to Round of 32/ })
    ).not.toBeInTheDocument();
    // The Phase 1 end-of-flow button is shown in its place.
    expect(screen.getByRole('button', { name: /Save Phase 1 Picks/ })).toBeInTheDocument();
    // The Knockout + Tiebreaker top tabs are locked (disabled).
    expect(screen.getByRole('tab', { name: /Knockout/ })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /Tiebreaker/ })).toBeDisabled();
  });

  it('shows BOTH Save Phase 1 Picks and Continue to Round 32 for super admin on Gut Feeling Champion in phase 1', async () => {
    // Super admins may be playing the pool themselves, so they still need
    // the Phase 1 commit action a regular user gets. They also retain the
    // "Continue to Round 32" jump because their phase2 fields are editable
    // (god-mode). Both buttons must coexist on this step.
    mockAuthProfile = { isSuperAdmin: true };
    configureQueries(); // phase 1 default
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );
    await user.click(screen.getByTestId('fill-champion'));

    expect(screen.getByRole('button', { name: /Save Phase 1 Picks/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Continue to Round of 32/ })
    ).toBeInTheDocument();
  });

  it('surfaces the missing prediction name when Save Phase 1 Picks is clicked', async () => {
    // 8/8 advancers ranked but the prediction-name field is still blank.
    // The Save button stays enabled (we let the user click) and clicking
    // raises a toast + inline error rather than silently doing nothing.
    configureQueries(); // phase 1
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );
    await user.click(screen.getByTestId('fill-champion'));

    const saveBtn = screen.getByRole('button', { name: /Save Phase 1 Picks/ });
    expect(saveBtn).toBeEnabled();

    await user.click(saveBtn);

    expect(toastError).toHaveBeenCalledWith('Prediction name is required.');
    expect(screen.getByRole('alert')).toHaveTextContent('Prediction name is required.');
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
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );
    await user.click(screen.getByTestId('fill-champion'));
    await user.click(screen.getByRole('button', { name: /Continue to Round of 32/ }));
    // Filling all knockout matches at once satisfies every knockout sub-step.
    await user.click(screen.getByTestId('fill-all-knockout'));

    const stages = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Third Place', 'Final'];
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
    // Final step shows the submit action inline instead of "Continue to …" —
    // clicking it triggers the actual submit/save, not just a scroll.
    expect(
      screen.getAllByRole('button', { name: /Submit Prediction/i }).length
    ).toBeGreaterThan(0);
  });

  it('renders a read-only view when the tournament is locked', async () => {
    // Regular users in a locked phase should still be able to *navigate*
    // between steps to view past picks — only edits/saves are blocked.
    // The submit/save card is hidden entirely and a read-only notice is
    // surfaced so the user understands why.
    configureQueries({ tournamentLockTime: new Date(Date.now() - 1000).toISOString() });
    render(<PredictionsPageContent mode="create" />);

    await screen.findByText(/read-only view of your picks/i);
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => expect(tab).not.toBeDisabled());
    expect(screen.queryByRole('button', { name: /Predictions Locked/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save progress/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit Prediction/ })).toBeNull();
  });

  it('lets a super admin advance past Groups when the tournament is locked', async () => {
    // Super admin keeps full write access through phase1_locked (admin
    // RPC bypasses the lock check). The wizard nav must follow suit so
    // they can actually reach Best 3rds + the knockout sub-steps when
    // editing a user's bracket post-lock.
    mockAuthProfile = { isSuperAdmin: true };
    configureQueries({
      tournamentLockTime: new Date(Date.now() - 1000).toISOString(),
      phase: 'phase1_locked',
    });
    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    // Wait for the wizard to hydrate past the skeleton. The "Locked" badge
    // on the lock-time card is the stable signal — Submit/Save buttons no
    // longer render outside Phase 1 (phase1_locked is a separate phase).
    await screen.findByText('Locked');
    expect(screen.getByRole('tab', { name: /Group Stage/ })).not.toBeDisabled();
    expect(screen.getByRole('tab', { name: /Best 3rds/ })).not.toBeDisabled();

    await user.click(screen.getByTestId('fill-all-groups'));

    const continueBtn = screen.getByRole('button', { name: /Continue to Best 3rds/ });
    expect(continueBtn).toBeEnabled();
    await user.click(continueBtn);
    expect(screen.getByTestId('advancers-form')).toBeInTheDocument();
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
          championTeamId: null,
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

    await screen.findByText(/read-only view of your picks/i);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clears the draft after a successful submit', async () => {
    // Phase 2 open so Submit is reachable — regular users can't submit in
    // phase 1 (Continue → R32 is replaced by Save Phase 1 Picks). Use a
    // super-admin profile so the champion pick (a Phase 1 field) is still
    // editable through the admin route — required because the wizard's
    // completion gate now includes isChampionPickComplete.
    mockAuthProfile = { isSuperAdmin: true };
    configureQueries({ phase: 'phase2_open' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-1' }),
    });
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<PredictionsPageContent mode="create" />);

    // Wizard starts at Round of 32 in phase 2; navigate back to Group
    // Stage and walk forward through Best 3rds → Gut Feeling Champion
    // (Phase 1 fields) → Round of 32 → … → Tiebreaker.
    await user.click(await screen.findByRole('tab', { name: /Group Stage/ }));
    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );
    await user.click(screen.getByTestId('fill-champion'));
    await user.click(screen.getByRole('button', { name: /Continue to Round of 32/ }));
    await user.click(screen.getByTestId('fill-all-knockout'));
    // Walk through R16 → QF → SF → Third Place → Final → Tiebreaker.
    for (const next of [
      'Round of 16',
      'Quarter-finals',
      'Semi-finals',
      'Third Place',
      'Final',
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

    // On the final (tiebreaker) step the bottom "Ready to submit?" card
    // is hidden — the inline stepper Submit is the only submit surface.
    await user.click(screen.getByRole('button', { name: /Submit Prediction/ }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('Phase 2 Continue triggers a silent server save', async () => {
    // The bug this guards against: in Phase 2 the wizard used to save picks
    // only to localStorage on change, so a reload between rounds threw them
    // away (because the prediction had submittedAt set from Phase 1, so the
    // draft-restore guard skipped). Continue now PATCHes the server first.
    configureQueries({ phase: 'phase2_open' });
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-1' }),
    });

    const initial = {
      id: 'pred-1',
      name: 'Main',
      totalGoals: null,
      championTeamId: 'arg',
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      isPaid: false,
      paidAt: null,
      groups: [],
      knockout: [],
      advancers: [],
    };

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="edit" predictionId="pred-1" initial={initial} />);

    // Wizard auto-jumps to R32 in phase2_open.
    await screen.findByTestId('knockout-bracket');
    await user.click(screen.getByTestId('fill-all-knockout'));

    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Continue to Round of 16/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/predictions/pred-1');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body);
    expect(body.knockout.length).toBeGreaterThan(0);
    expect(body.submit).toBe(false);
    // Silent autosave: no "Progress saved" toast.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('Phase 2 Continue does NOT save when nothing changed', async () => {
    // Change-detection: navigating across rounds without editing should not
    // hit the DB — the wizard just advances. Baseline is the server state
    // seeded at hydration (a fully-filled bracket here).
    configureQueries({ phase: 'phase2_open' });
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-1' }),
    });

    const initial = {
      id: 'pred-1',
      name: 'Main',
      totalGoals: 7,
      championTeamId: 'arg',
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      isPaid: false,
      paidAt: null,
      groups: [],
      knockout: fixtureKnockoutMatches.map((m) => ({ matchId: m.id, winner: 'mex' })),
      advancers: [],
    };

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="edit" predictionId="pred-1" initial={initial} />);

    // Wizard auto-jumps to R32; bracket is already complete from `initial`.
    await screen.findByTestId('knockout-bracket');
    await user.click(screen.getByRole('button', { name: /Continue to Round of 16/ }));

    // Advanced to R16 without a server round-trip.
    await screen.findByRole('button', { name: /Continue to Quarter-finals/ });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Phase 2 Continue saves once a pick changes (dirty after a clean baseline)', async () => {
    // Same fully-filled baseline, but editing a pick makes it dirty, so the
    // next nav DOES persist.
    configureQueries({ phase: 'phase2_open' });
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-1' }),
    });

    const initial = {
      id: 'pred-1',
      name: 'Main',
      totalGoals: 7,
      championTeamId: 'arg',
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      isPaid: false,
      paidAt: null,
      groups: [],
      knockout: fixtureKnockoutMatches.map((m) => ({ matchId: m.id, winner: 'mex' })),
      advancers: [],
    };

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="edit" predictionId="pred-1" initial={initial} />);

    await screen.findByTestId('knockout-bracket');
    // Re-fill all knockout winners to a different value → dirty vs baseline.
    await user.click(screen.getByTestId('fill-all-knockout'));
    await user.click(screen.getByRole('button', { name: /Continue to Round of 16/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).submit).toBe(false);
  });

  it('Phase 1 nav triggers a silent server save once the champion is picked', async () => {
    configureQueries(); // phase 1 default
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-new' }),
    });

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    await user.type(screen.getByLabelText(/Prediction name/), 'Main');
    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );
    // No champion yet — Continue/Back nav up to this point must not fire
    // a server save (RPC requires champion_team_id in Phase 1).
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('fill-champion'));
    // Phase 1 champion_pick has no Continue for regular users; Back to
    // Best 3rds still goes through navigateWithAutosave.
    await user.click(screen.getByRole('button', { name: /Back: Best 3rds/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/predictions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.submit).toBe(false);
    expect(body.championTeamId).toBe('team-arg');
    expect(body.groups.length).toBeGreaterThan(0);
    // Silent autosave: no "Progress saved" toast.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('Phase 1 nav skips the server save until the champion is picked', async () => {
    configureQueries(); // phase 1 default
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-new' }),
    });

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="create" />);

    await user.type(screen.getByLabelText(/Prediction name/), 'Main');
    await user.click(await screen.findByTestId('fill-all-groups'));
    await user.click(screen.getByRole('button', { name: /Continue to Best 3rds/ }));
    await user.click(screen.getByTestId('fill-all-bundles'));
    await user.click(
      screen.getByRole('button', { name: /Continue to Gut Feeling Champion/ })
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Phase 2 submit succeeds for a legacy prediction with stale Phase 1 fields', async () => {
    // Regression: in Phase 2 the submit gate used to require ALL Phase 1
    // fields to be complete (champion + 12×4 group positions + 8
    // advancers). Legacy predictions can have null champion, partial
    // group standings (no 3rd/4th from pre-advancers schema), or zero
    // advancer rows — none of which a regular user can fix in Phase 2
    // (the forms are read-only). The two phases are decoupled
    // everywhere else (server RPC, payload composition, UI editability),
    // so the submit gate must only check Phase 2 fields.
    configureQueries({ phase: 'phase2_open' });
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-legacy' }),
    });

    const initial = {
      id: 'pred-legacy',
      name: 'Legacy',
      totalGoals: null,
      championTeamId: null, // legacy: no champion picked
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      isPaid: false,
      paidAt: null,
      // Partial groups: 1st/2nd only, no 3rd/4th — mirrors pre-advancers
      // schema where 3rd-place picks weren't collected.
      groups: fixtureGroups.map((g) => ({
        groupId: g.id,
        first: g.teams[0].id,
        second: g.teams[1].id,
        third: null,
        fourth: null,
      })),
      knockout: fixtureKnockoutMatches.map((m) => ({
        matchId: m.id,
        winner: 'mex',
      })),
      // No advancer rows at all (legacy pre-0025 prediction).
      advancers: [],
    };

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="edit" predictionId="pred-legacy" initial={initial} />);

    // Walk to the tiebreaker step (wizard auto-jumps to R32 in phase2_open).
    await screen.findByTestId('knockout-bracket');
    for (const next of [
      'Round of 16',
      'Quarter-finals',
      'Semi-finals',
      'Third Place',
      'Final',
      'Tiebreaker',
    ]) {
      await user.click(
        await screen.findByRole('button', {
          name: new RegExp(`Continue to ${next}`, 'i'),
        })
      );
    }
    await user.click(screen.getByTestId('set-tiebreaker'));

    await user.click(screen.getByRole('button', { name: /Submit Prediction/ }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Prediction submitted'));
    expect(toastError).not.toHaveBeenCalledWith(
      'Please complete all predictions before submitting'
    );
    // The submit call must NOT carry championTeamId (Phase 2 regular path
    // strips Phase 1 fields).
    const submitCall = fetchMock.mock.calls.find(([, init]) => {
      try {
        return JSON.parse((init as RequestInit).body as string).submit === true;
      } catch {
        return false;
      }
    });
    expect(submitCall).toBeDefined();
    const submitBody = JSON.parse((submitCall![1] as RequestInit).body as string);
    expect(submitBody.championTeamId).toBeUndefined();
  });

  it('Phase 2: the third-place (M103) round gates bracket completion', async () => {
    // M103 (third-place playoff) is a required, scored (+5) knockout
    // round again. Filling every other knockout match but leaving M103
    // unpicked must leave the bracket incomplete — Continue off the Third
    // Place step stays disabled until M103 has a winner.
    configureQueries({ phase: 'phase2_open' });
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-1' }),
    });

    const initial = {
      id: 'pred-1',
      name: 'Main',
      totalGoals: null,
      championTeamId: 'arg',
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      isPaid: false,
      paidAt: null,
      groups: [],
      knockout: [],
      advancers: [],
    };

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="edit" predictionId="pred-1" initial={initial} />);

    // Wizard auto-jumps to R32; fill every match EXCEPT M103, then walk
    // forward to the Third Place step (it sits just before the Final).
    await screen.findByTestId('knockout-bracket');
    await user.click(screen.getByTestId('fill-all-knockout-except-third'));
    for (const next of ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Third Place']) {
      await user.click(
        await screen.findByRole('button', {
          name: new RegExp(`Continue to ${next}`, 'i'),
        })
      );
    }

    // On the Third Place step with M103 unpicked, advancing is blocked.
    expect(
      await screen.findByRole('button', { name: /Continue to Final/ })
    ).toBeDisabled();

    // Pick the third-place winner → step completes, Continue unlocks.
    await user.click(screen.getByTestId('fill-all-knockout'));
    await user.click(await screen.findByRole('button', { name: /Continue to Final/ }));
    await user.click(
      await screen.findByRole('button', { name: /Continue to Tiebreaker/ })
    );
    await user.click(screen.getByTestId('set-tiebreaker'));
    await user.click(screen.getByRole('button', { name: /Submit Prediction/ }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Prediction submitted'));
    expect(toastError).not.toHaveBeenCalledWith(
      'Please complete all predictions before submitting'
    );
  });

  it('renders Save progress on a Phase 1 round step', async () => {
    configureQueries(); // phase 1 default
    render(<PredictionsPageContent mode="create" />);

    // Group Stage is a "round" — the user can checkpoint here without
    // advancing to Best 3rds.
    await screen.findByTestId('fill-all-groups');
    expect(screen.getByRole('button', { name: /Save progress/i })).toBeInTheDocument();
  });

  it('Save progress persists in place on a Phase 2 knockout round (no advance)', async () => {
    // The button exists so a user editing the current round can save
    // without navigating (auto-save only fires on Continue / Back / tab).
    configureQueries({ phase: 'phase2_open' });
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ predictionId: 'pred-1' }),
    });

    const initial = {
      id: 'pred-1',
      name: 'Main',
      totalGoals: null,
      championTeamId: 'arg',
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      isPaid: false,
      paidAt: null,
      groups: [],
      knockout: [],
      advancers: [],
    };

    const user = userEvent.setup();
    render(<PredictionsPageContent mode="edit" predictionId="pred-1" initial={initial} />);

    // Wizard auto-jumps to R32 in phase2_open.
    await screen.findByTestId('knockout-bracket');
    await user.click(screen.getByTestId('fill-all-knockout'));

    await user.click(screen.getByRole('button', { name: /Save progress/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/predictions/pred-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body).submit).toBe(false);
    // Still on the same round — Save progress does not navigate.
    expect(screen.getByTestId('knockout-bracket')).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith('Progress saved');
  });

  it('does not render Save progress in a locked read-only view', async () => {
    configureQueries({ tournamentLockTime: new Date(Date.now() - 1000).toISOString() });
    render(<PredictionsPageContent mode="create" />);

    await screen.findByText(/read-only view of your picks/i);
    expect(screen.queryByRole('button', { name: /Save progress/i })).toBeNull();
  });
});
