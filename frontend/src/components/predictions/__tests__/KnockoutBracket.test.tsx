import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnockoutBracket } from '../KnockoutBracket';
import type { GroupPrediction, KnockoutMatchPrediction } from '@/types/tournament';

// Create empty group predictions for all 12 groups
const createEmptyGroupPredictions = (): GroupPrediction[] => {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((groupId) => ({
    groupId,
    positions: {
      first: null,
      second: null,
      third: null,
      fourth: null,
    },
  }));
};

// Create complete group predictions
const createCompleteGroupPredictions = (): GroupPrediction[] => {
  return [
    { groupId: 'A', positions: { first: 'usa', second: 'mex', third: 'can', fourth: 'jam' } },
    { groupId: 'B', positions: { first: 'arg', second: 'col', third: 'par', fourth: 'ecu' } },
    { groupId: 'C', positions: { first: 'bra', second: 'uru', third: 'ven', fourth: 'per' } },
    { groupId: 'D', positions: { first: 'eng', second: 'fra', third: 'ned', fourth: 'wal' } },
    { groupId: 'E', positions: { first: 'ger', second: 'esp', third: 'por', fourth: 'sui' } },
    { groupId: 'F', positions: { first: 'ita', second: 'bel', third: 'cro', fourth: 'aut' } },
    { groupId: 'G', positions: { first: 'jpn', second: 'kor', third: 'aus', fourth: 'sau' } },
    { groupId: 'H', positions: { first: 'irn', second: 'qat', third: 'uae', fourth: 'uzb' } },
    { groupId: 'I', positions: { first: 'sen', second: 'mar', third: 'nig', fourth: 'cam' } },
    { groupId: 'J', positions: { first: 'egy', second: 'alg', third: 'gha', fourth: 'tun' } },
    { groupId: 'K', positions: { first: 'pol', second: 'den', third: 'swe', fourth: 'cze' } },
    { groupId: 'L', positions: { first: 'ser', second: 'ukr', third: 'sco', fourth: 'nor' } },
  ];
};

// Create empty knockout predictions
const createEmptyKnockoutPredictions = (): KnockoutMatchPrediction[] => {
  return [];
};

// Create some knockout predictions
const createSomeKnockoutPredictions = (): KnockoutMatchPrediction[] => {
  return [
    { matchId: 'M1', winnerId: 'usa' },
    { matchId: 'M2', winnerId: 'bra' },
    { matchId: 'M3', winnerId: 'ger' },
  ];
};

describe('KnockoutBracket', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createEmptyGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText('Knockout Bracket')).toBeInTheDocument();
    });

    it('should render stage tabs', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createEmptyGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Check for stage labels (may appear in both tab and content header)
      expect(screen.getAllByText(/Round of 32/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Round of 16/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Quarter-finals/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Semi-finals/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Final/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Third Place/i).length).toBeGreaterThanOrEqual(1);
    });

    it('should show helper text', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createEmptyGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Click on a team to select them as the winner/i)).toBeInTheDocument();
    });
  });

  describe('completion tracking', () => {
    it('should show 0/32 matches predicted when empty', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createEmptyGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText('0 / 32 matches predicted')).toBeInTheDocument();
    });

    it('should show partial completion count', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createCompleteGroupPredictions()}
          knockoutPredictions={createSomeKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText('3 / 32 matches predicted')).toBeInTheDocument();
    });
  });

  describe('team resolution', () => {
    it('should show TBD when group predictions are incomplete', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createEmptyGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Should have TBD placeholders for teams
      const tbdElements = screen.getAllByText(/TBD/);
      expect(tbdElements.length).toBeGreaterThan(0);
    });

    it('should show team names when group predictions are complete', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createCompleteGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Should show team names from group predictions
      // 1A = USA (winner of Group A)
      expect(screen.getByText('United States')).toBeInTheDocument();
      // 2B = COL (2nd place in Group B)
      expect(screen.getByText('Colombia')).toBeInTheDocument();
    });
  });

  describe('stage navigation', () => {
    it('should switch between stages when tabs are clicked', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();

      render(
        <KnockoutBracket
          groupPredictions={createCompleteGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Click on Quarter-finals tab
      const qfTab = screen.getByRole('tab', { name: /Quarter-finals/i });
      await user.click(qfTab);

      // Tab should be selected (active state)
      expect(qfTab).toHaveAttribute('data-state', 'active');
    });

    it('should show point values for each stage', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createCompleteGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Round of 32 is shown by default, should have +2 pts
      expect(screen.getByText(/\+2 pts each/)).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable team selection buttons when disabled', () => {
      const mockOnChange = jest.fn();
      render(
        <KnockoutBracket
          groupPredictions={createCompleteGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
          disabled={true}
        />
      );

      // Team buttons should be disabled
      const teamButtons = screen.getAllByRole('button', { name: /USA|United States/i });
      teamButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('interaction', () => {
    it('should call onPredictionChange when a team is selected', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();

      render(
        <KnockoutBracket
          groupPredictions={createCompleteGroupPredictions()}
          knockoutPredictions={createEmptyKnockoutPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Find and click on a team button (USA)
      const usaButton = screen.getByRole('button', { name: /USA.*United States/i });
      await user.click(usaButton);

      // Should call onPredictionChange with match ID and team ID
      expect(mockOnChange).toHaveBeenCalledWith('M1', 'usa');
    });
  });
});
