import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupStageForm } from '../GroupStageForm';
import type { GroupPrediction } from '@/types/tournament';

// Create empty predictions for all 12 groups
const createEmptyPredictions = (): GroupPrediction[] => {
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

// Create predictions with some filled groups
const createPartialPredictions = (): GroupPrediction[] => {
  const predictions = createEmptyPredictions();
  // Fill Group A completely
  predictions[0] = {
    groupId: 'A',
    positions: {
      first: 'usa',
      second: 'mex',
      third: 'can',
      fourth: 'jam',
    },
  };
  // Partially fill Group B
  predictions[1] = {
    groupId: 'B',
    positions: {
      first: 'arg',
      second: 'col',
      third: null,
      fourth: null,
    },
  };
  return predictions;
};

// Create fully completed predictions
const createCompletePredictions = (): GroupPrediction[] => {
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

describe('GroupStageForm', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      expect(screen.getByText('Group Stage Predictions')).toBeInTheDocument();
    });

    it('should render all 12 groups', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      // Check for all group headers
      expect(screen.getByText('Group A')).toBeInTheDocument();
      expect(screen.getByText('Group B')).toBeInTheDocument();
      expect(screen.getByText('Group C')).toBeInTheDocument();
      expect(screen.getByText('Group D')).toBeInTheDocument();
      expect(screen.getByText('Group E')).toBeInTheDocument();
      expect(screen.getByText('Group F')).toBeInTheDocument();
      expect(screen.getByText('Group G')).toBeInTheDocument();
      expect(screen.getByText('Group H')).toBeInTheDocument();
      expect(screen.getByText('Group I')).toBeInTheDocument();
      expect(screen.getByText('Group J')).toBeInTheDocument();
      expect(screen.getByText('Group K')).toBeInTheDocument();
      expect(screen.getByText('Group L')).toBeInTheDocument();
    });

    it('should render position labels', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      // Each group has 4 position labels
      const firstLabels = screen.getAllByText('1st');
      const secondLabels = screen.getAllByText('2nd');
      const thirdLabels = screen.getAllByText('3rd');
      const fourthLabels = screen.getAllByText('4th');

      expect(firstLabels).toHaveLength(12);
      expect(secondLabels).toHaveLength(12);
      expect(thirdLabels).toHaveLength(12);
      expect(fourthLabels).toHaveLength(12);
    });

    it('should render helper text', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      expect(screen.getByText(/Predict the final standings for each group/i)).toBeInTheDocument();
    });
  });

  describe('completion tracking', () => {
    it('should show 0/12 groups complete when empty', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      expect(screen.getByText('0 / 12 groups complete')).toBeInTheDocument();
    });

    it('should show partial completion count', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          predictions={createPartialPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Group A is complete (4/4), Group B is partial (2/4)
      expect(screen.getByText('1 / 12 groups complete')).toBeInTheDocument();
    });

    it('should show 12/12 groups complete when all filled', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          predictions={createCompletePredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText('12 / 12 groups complete')).toBeInTheDocument();
    });

    it('should show "Complete" badge for completed groups', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          predictions={createPartialPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Group A should have Complete badge
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('should show position count for incomplete groups', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          predictions={createPartialPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Group B has 2/4 filled
      expect(screen.getByText('2/4')).toBeInTheDocument();

      // Empty groups should show 0/4
      const zeroCountBadges = screen.getAllByText('0/4');
      expect(zeroCountBadges.length).toBeGreaterThan(0);
    });
  });

  describe('select triggers', () => {
    it('should render select triggers for each position', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      // 12 groups × 4 positions = 48 select triggers
      const selectTriggers = screen.getAllByRole('combobox');
      expect(selectTriggers).toHaveLength(48);
    });

    it('should show placeholder text when no selection', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      const placeholders = screen.getAllByText('Select team');
      expect(placeholders.length).toBeGreaterThan(0);
    });
  });

  describe('disabled state', () => {
    it('should disable all selects when disabled prop is true', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
          disabled={true}
        />
      );

      const selectTriggers = screen.getAllByRole('combobox');
      selectTriggers.forEach((trigger) => {
        expect(trigger).toBeDisabled();
      });
    });

    it('should not disable selects when disabled prop is false', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
          disabled={false}
        />
      );

      const selectTriggers = screen.getAllByRole('combobox');
      selectTriggers.forEach((trigger) => {
        expect(trigger).not.toBeDisabled();
      });
    });
  });

  describe('interaction', () => {
    it('should render select triggers that can be interacted with', () => {
      const mockOnChange = jest.fn();

      render(
        <GroupStageForm predictions={createEmptyPredictions()} onPredictionChange={mockOnChange} />
      );

      // Verify select triggers are rendered and can receive interactions
      const selectTriggers = screen.getAllByRole('combobox');
      expect(selectTriggers.length).toBe(48); // 12 groups × 4 positions
      expect(selectTriggers[0]).toBeEnabled();
    });

    it('should show selected team in the trigger', () => {
      const mockOnChange = jest.fn();
      const predictions = createEmptyPredictions();
      predictions[0].positions.first = 'usa';

      render(<GroupStageForm predictions={predictions} onPredictionChange={mockOnChange} />);

      // The selected team should be visible in the trigger
      expect(screen.getByText('United States')).toBeInTheDocument();
    });
  });
});
