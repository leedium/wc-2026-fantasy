import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnockoutBracket } from '../KnockoutBracket';
import type { GroupPrediction, KnockoutMatchPrediction } from '@/types/tournament';
import { fixtureKnockoutMatches, fixtureTeams } from '@/test-utils/fixtures';

const createEmptyGroupPredictions = (): GroupPrediction[] => {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((groupId) => ({
    groupId,
    positions: { first: null, second: null, third: null, fourth: null },
  }));
};

const createCompleteGroupPredictions = (): GroupPrediction[] => [
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

const createEmptyKnockoutPredictions = (): KnockoutMatchPrediction[] =>
  fixtureKnockoutMatches.map((m) => ({ matchId: m.id, winnerId: null }));

const createSomeKnockoutPredictions = (): KnockoutMatchPrediction[] => {
  const base = createEmptyKnockoutPredictions();
  base[0].winnerId = 'mex';
  base[1].winnerId = 'bra';
  base[2].winnerId = 'ger';
  return base;
};

function renderBracket(
  overrides: Partial<React.ComponentProps<typeof KnockoutBracket>> = {}
) {
  const props: React.ComponentProps<typeof KnockoutBracket> = {
    matches: fixtureKnockoutMatches,
    teams: fixtureTeams,
    groupPredictions: createEmptyGroupPredictions(),
    knockoutPredictions: createEmptyKnockoutPredictions(),
    onPredictionChange: jest.fn(),
    stage: 'round_of_32',
    ...overrides,
  };
  render(<KnockoutBracket {...props} />);
  return props;
}

describe('KnockoutBracket', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      renderBracket();
      expect(screen.getByText('Knockout Bracket')).toBeInTheDocument();
    });

    it('renders only the matches for the active stage', () => {
      renderBracket({ stage: 'quarter_finals', groupPredictions: createCompleteGroupPredictions() });
      // QF has 4 match cards (M97-M100); R32 has 16 (M73-M88). Only QF should render.
      expect(screen.getByText('M97')).toBeInTheDocument();
      expect(screen.queryByText('M73')).not.toBeInTheDocument();
      expect(screen.queryByText('M89')).not.toBeInTheDocument();
    });

    it('shows the stage subtitle for the active stage', () => {
      renderBracket();
      expect(
        screen.getByText(/\+5 if you pick the match winner correctly/i)
      ).toBeInTheDocument();
    });

    it('should show helper text', () => {
      renderBracket();
      expect(screen.getByText(/Click a team to pick the winner/i)).toBeInTheDocument();
    });

    it('renders v4 flat per-round badges in the persistent summary', () => {
      renderBracket();
      expect(screen.getByText('R32 +5')).toBeInTheDocument();
      expect(screen.getByText('R16 +8')).toBeInTheDocument();
      expect(screen.getByText('QF +12')).toBeInTheDocument();
      expect(screen.getByText('SF +18')).toBeInTheDocument();
      expect(screen.getByText('Final +30')).toBeInTheDocument();
    });
  });

  describe('completion tracking', () => {
    it('should show 0/32 matches predicted when empty', () => {
      renderBracket();
      expect(screen.getByText('0 / 32 matches predicted')).toBeInTheDocument();
    });

    it('should show partial completion count', () => {
      renderBracket({
        groupPredictions: createCompleteGroupPredictions(),
        knockoutPredictions: createSomeKnockoutPredictions(),
      });
      expect(screen.getByText('3 / 32 matches predicted')).toBeInTheDocument();
    });
  });

  describe('team resolution', () => {
    it('should show TBD when group predictions are incomplete', () => {
      renderBracket();
      const tbdElements = screen.getAllByText(/TBD/);
      expect(tbdElements.length).toBeGreaterThan(0);
    });

    it('should show team names when group predictions are complete', () => {
      renderBracket({ groupPredictions: createCompleteGroupPredictions() });
      // Group A first place advances to M73; Group D first place advances to M74.
      expect(screen.getByText('Mexico')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable team selection buttons when disabled', () => {
      renderBracket({ groupPredictions: createCompleteGroupPredictions(), disabled: true });
      const teamButtons = screen.getAllByRole('button', { name: /USA|United States/i });
      teamButtons.forEach((button) => expect(button).toBeDisabled());
    });
  });

  describe('interaction', () => {
    it('should call onPredictionChange when a team is selected', async () => {
      const user = userEvent.setup();
      const onPredictionChange = jest.fn();
      renderBracket({
        groupPredictions: createCompleteGroupPredictions(),
        onPredictionChange,
      });
      const mexButton = screen.getByRole('button', { name: /MEX.*Mexico/i });
      await user.click(mexButton);
      expect(onPredictionChange).toHaveBeenCalledWith('M73', 'mex');
    });
  });
});
