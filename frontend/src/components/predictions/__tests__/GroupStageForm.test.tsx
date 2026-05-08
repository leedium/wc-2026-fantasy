import { render, screen } from '@testing-library/react';
import { GroupStageForm } from '../GroupStageForm';
import type { GroupPrediction } from '@/types/tournament';
import { fixtureGroups } from '@/test-utils/fixtures';

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
      first: 'mex',
      second: 'kor',
      third: 'rsa',
      fourth: 'cze',
    },
  };
  // Partially fill Group B
  predictions[1] = {
    groupId: 'B',
    positions: {
      first: 'can',
      second: 'sui',
      third: null,
      fourth: null,
    },
  };
  return predictions;
};

// Create fully completed predictions
const createCompletePredictions = (): GroupPrediction[] => {
  return [
    { groupId: 'A', positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' } },
    { groupId: 'B', positions: { first: 'can', second: 'sui', third: 'qat', fourth: 'bih' } },
    { groupId: 'C', positions: { first: 'bra', second: 'mar', third: 'sco', fourth: 'hai' } },
    { groupId: 'D', positions: { first: 'usa', second: 'par', third: 'aus', fourth: 'tur' } },
    { groupId: 'E', positions: { first: 'ger', second: 'ecu', third: 'civ', fourth: 'cuw' } },
    { groupId: 'F', positions: { first: 'ned', second: 'jpn', third: 'tun', fourth: 'swe' } },
    { groupId: 'G', positions: { first: 'bel', second: 'irn', third: 'egy', fourth: 'nzl' } },
    { groupId: 'H', positions: { first: 'esp', second: 'uru', third: 'sau', fourth: 'cpv' } },
    { groupId: 'I', positions: { first: 'fra', second: 'sen', third: 'nor', fourth: 'irq' } },
    { groupId: 'J', positions: { first: 'arg', second: 'aut', third: 'alg', fourth: 'jor' } },
    { groupId: 'K', positions: { first: 'por', second: 'col', third: 'uzb', fourth: 'cod' } },
    { groupId: 'L', positions: { first: 'eng', second: 'cro', third: 'pan', fourth: 'gha' } },
  ];
};

describe('GroupStageForm', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText('Group Stage Predictions')).toBeInTheDocument();
    });

    it('should render all 12 groups', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
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
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
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
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Predict the final standings for each group/i)).toBeInTheDocument();
    });
  });

  describe('completion tracking', () => {
    it('should show 0/12 groups complete when empty', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      expect(screen.getByText('0 / 12 groups complete')).toBeInTheDocument();
    });

    it('should show partial completion count', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          groups={fixtureGroups}
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
          groups={fixtureGroups}
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
          groups={fixtureGroups}
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
          groups={fixtureGroups}
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
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // 12 groups × 4 positions = 48 select triggers
      const selectTriggers = screen.getAllByRole('combobox');
      expect(selectTriggers).toHaveLength(48);
    });

    it('should show placeholder text when no selection', () => {
      const mockOnChange = jest.fn();
      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
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
          groups={fixtureGroups}
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
          groups={fixtureGroups}
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
        <GroupStageForm
          groups={fixtureGroups}
          predictions={createEmptyPredictions()}
          onPredictionChange={mockOnChange}
        />
      );

      // Verify select triggers are rendered and can receive interactions
      const selectTriggers = screen.getAllByRole('combobox');
      expect(selectTriggers.length).toBe(48); // 12 groups × 4 positions
      expect(selectTriggers[0]).toBeEnabled();
    });

    it('should show selected team in the trigger', () => {
      const mockOnChange = jest.fn();
      const predictions = createEmptyPredictions();
      predictions[0].positions.first = 'mex';

      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={predictions}
          onPredictionChange={mockOnChange}
        />
      );

      // The selected team should be visible in the trigger
      expect(screen.getByText('Mexico')).toBeInTheDocument();
    });
  });

  describe('auto-fill 4th place', () => {
    it('auto-fires onPredictionChange for the 4th when 1, 2, 3 are filled', () => {
      const mockOnChange = jest.fn();
      const predictions = createEmptyPredictions();
      // Group A teams: mex, kor, rsa, cze. Picking 1/2/3 leaves cze for 4th.
      predictions[0] = {
        groupId: 'A',
        positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: null },
      };

      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={predictions}
          onPredictionChange={mockOnChange}
        />
      );

      expect(mockOnChange).toHaveBeenCalledWith('A', 'fourth', 'cze');
    });

    it('does not re-fire onPredictionChange when 4 already matches the leftover', () => {
      const mockOnChange = jest.fn();
      const predictions = createEmptyPredictions();
      predictions[0] = {
        groupId: 'A',
        positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' },
      };

      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={predictions}
          onPredictionChange={mockOnChange}
        />
      );

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('disables the 4th-place select when auto-filled', () => {
      const mockOnChange = jest.fn();
      const predictions = createEmptyPredictions();
      predictions[0] = {
        groupId: 'A',
        positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' },
      };

      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={predictions}
          onPredictionChange={mockOnChange}
        />
      );

      const selects = screen.getAllByRole('combobox');
      // Group A is the first card in the grid → first 4 selects belong to it.
      const groupAFourth = selects[3];
      expect(groupAFourth).toBeDisabled();
    });

    it('leaves the 4th select enabled when top-3 is incomplete', () => {
      const mockOnChange = jest.fn();
      const predictions = createEmptyPredictions();
      predictions[0] = {
        groupId: 'A',
        positions: { first: 'mex', second: 'kor', third: null, fourth: null },
      };

      render(
        <GroupStageForm
          groups={fixtureGroups}
          predictions={predictions}
          onPredictionChange={mockOnChange}
        />
      );

      const selects = screen.getAllByRole('combobox');
      const groupAFourth = selects[3];
      expect(groupAFourth).toBeEnabled();
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });
});
