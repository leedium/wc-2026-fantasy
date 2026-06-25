import { render, screen } from '@testing-library/react';
import { PrizeTables } from '../PrizeTables';
import { usePhase1Winners } from '@/hooks/usePhase1Winners';
import type { Phase1Winner } from '@/types/tournament';

jest.mock('@/hooks/usePhase1Winners', () => ({
  usePhase1Winners: jest.fn(),
}));

const mockUsePhase1Winners = usePhase1Winners as jest.MockedFunction<typeof usePhase1Winners>;

function setWinners(winners: Phase1Winner[]) {
  mockUsePhase1Winners.mockReturnValue({
    winners,
    isLoading: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof usePhase1Winners>);
}

describe('PrizeTables', () => {
  beforeEach(() => {
    // Default: no snapshot yet, so the generic Phase 1 prize card shows.
    setWinners([]);
  });

  it('renders both phase headings', () => {
    render(<PrizeTables />);
    expect(screen.getByText('Phase 1 — Group Stage')).toBeInTheDocument();
    expect(screen.getByText('Phase 2 — Knockout')).toBeInTheDocument();
  });

  it('renders the Phase 1 (top 3) prize amounts', () => {
    render(<PrizeTables />);
    expect(screen.getByText('$200')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('renders the Phase 2 (top 5) prize amounts including 4th and 5th', () => {
    render(<PrizeTables />);
    expect(screen.getByText('$2,000')).toBeInTheDocument();
    expect(screen.getByText('$700')).toBeInTheDocument();
    expect(screen.getByText('$215')).toBeInTheDocument();
    expect(screen.getByText('$142')).toBeInTheDocument();
  });

  it('shows place badges through 5th', () => {
    render(<PrizeTables />);
    // 4th/5th only exist in Phase 2; 1st–3rd appear in both phases.
    expect(screen.getByText('4th')).toBeInTheDocument();
    expect(screen.getByText('5th')).toBeInTheDocument();
    expect(screen.getAllByText('1st')).toHaveLength(2);
  });

  it('flags the active phase with an "Active now" badge', () => {
    render(<PrizeTables activePhase="phase2" />);
    expect(screen.getByText('Active now')).toBeInTheDocument();
  });

  it('renders no active badge when activePhase is omitted', () => {
    render(<PrizeTables />);
    expect(screen.queryByText('Active now')).not.toBeInTheDocument();
  });

  it('shows the charity / management-fee deduction footnote with links', () => {
    render(<PrizeTables />);
    expect(screen.getByRole('link', { name: 'charity' })).toHaveAttribute('href', '/charities');
    expect(screen.getByRole('link', { name: 'management fees' })).toHaveAttribute(
      'href',
      '/audit'
    );
  });

  it('replaces the Phase 1 prize card with the winners table once snapshotted', () => {
    setWinners([
      {
        rank: 1,
        predictionId: 'p-dave',
        predictionName: 'Dave Picks',
        username: 'dave',
        groupPoints: 125,
        advancerPoints: 20,
        phase1Points: 145,
      },
      {
        rank: 2,
        predictionId: 'p-carol',
        predictionName: 'Carol Picks',
        username: 'carol',
        groupPoints: 117,
        advancerPoints: 16,
        phase1Points: 133,
      },
    ]);
    render(<PrizeTables activePhase="phase2" />);

    // Winners table takes the Phase 1 slot; the generic Phase 1 card is gone.
    expect(screen.getByText('Phase 1 Winners')).toBeInTheDocument();
    expect(screen.queryByText('Phase 1 — Group Stage')).not.toBeInTheDocument();
    expect(screen.getByText('Dave Picks')).toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument(); // Dave's Phase 1 points (unique)
    // $400 = Dave's 1st-place Phase 1 prize AND the Phase 2 3rd-place prize.
    expect(screen.getAllByText('$400')).toHaveLength(2);
    // Phase 2 prize card still renders alongside it.
    expect(screen.getByText('Phase 2 — Knockout')).toBeInTheDocument();
  });
});
