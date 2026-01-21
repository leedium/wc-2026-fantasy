import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PredictionsPageContent } from '../PredictionsPageContent';
import {
  useWallet,
  setWalletConnected,
  setWalletDisconnected,
} from '@solana/wallet-adapter-react';

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  setWalletDisconnected();
});

describe('PredictionsPageContent', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('Make Your Predictions')).toBeInTheDocument();
    });

    it('should render page description', () => {
      render(<PredictionsPageContent />);

      expect(
        screen.getByText(/Submit your bracket predictions for the World Cup 2026/i)
      ).toBeInTheDocument();
    });

    it('should render tournament status card', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('Lock Time')).toBeInTheDocument();
      expect(screen.getByText('Entry Fee')).toBeInTheDocument();
      expect(screen.getByText('0.1 SOL')).toBeInTheDocument();
    });

    it('should render prediction progress section', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('Prediction Progress')).toBeInTheDocument();
      // These texts appear multiple times (in tabs and progress), so use getAllBy
      expect(screen.getAllByText('Group Stage').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Knockout/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Tiebreaker/i).length).toBeGreaterThanOrEqual(1);
    });

    it('should render tabs for predictions', () => {
      render(<PredictionsPageContent />);

      // Check for tab triggers
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('should render submit section', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('Ready to submit?')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Submit Predictions/i })
      ).toBeInTheDocument();
    });
  });

  describe('wallet connection', () => {
    it('should show connect wallet message when disconnected', () => {
      setWalletDisconnected();
      render(<PredictionsPageContent />);

      expect(
        screen.getByText('Connect your wallet to submit predictions')
      ).toBeInTheDocument();
    });

    it('should disable submit button when wallet is disconnected', () => {
      setWalletDisconnected();
      render(<PredictionsPageContent />);

      const submitButton = screen.getByRole('button', { name: /Submit Predictions/i });
      expect(submitButton).toBeDisabled();
    });

    it('should not show connect message when wallet is connected', () => {
      setWalletConnected();
      render(<PredictionsPageContent />);

      // Should show incomplete predictions message instead
      expect(
        screen.queryByText('Connect your wallet to submit predictions')
      ).not.toBeInTheDocument();
    });
  });

  describe('prediction progress', () => {
    it('should show 0/12 groups complete initially', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('0 / 12 complete')).toBeInTheDocument();
    });

    it('should show 0/32 knockout matches initially', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('0 / 32 matches')).toBeInTheDocument();
    });

    it('should show "Not set" for tiebreaker initially', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('Not set')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('should show group stage content by default', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('Group Stage Predictions')).toBeInTheDocument();
    });

    it('should switch to knockout tab when clicked', async () => {
      const user = userEvent.setup();
      render(<PredictionsPageContent />);

      const knockoutTab = screen.getByRole('tab', { name: /Knockout/i });
      await user.click(knockoutTab);

      // The knockout bracket component should be visible (it has a heading)
      expect(screen.getAllByText('Knockout Bracket').length).toBeGreaterThanOrEqual(1);
    });

    it('should switch to tiebreaker tab when clicked', async () => {
      const user = userEvent.setup();
      render(<PredictionsPageContent />);

      const tiebreakerTab = screen.getByRole('tab', { name: /Tiebreaker/i });
      await user.click(tiebreakerTab);

      expect(screen.getByText('Tiebreaker: Total Goals')).toBeInTheDocument();
    });
  });

  describe('submit button state', () => {
    it('should show incomplete message when predictions are not complete', () => {
      setWalletConnected();
      render(<PredictionsPageContent />);

      expect(
        screen.getByText('Complete all predictions to submit')
      ).toBeInTheDocument();
    });

    it('should disable submit when predictions are incomplete', () => {
      setWalletConnected();
      render(<PredictionsPageContent />);

      const submitButton = screen.getByRole('button', { name: /Submit Predictions/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('tournament status', () => {
    it('should show "Accepting Predictions" badge for upcoming tournament', () => {
      render(<PredictionsPageContent />);

      expect(screen.getByText('Accepting Predictions')).toBeInTheDocument();
    });

    it('should display time remaining', () => {
      render(<PredictionsPageContent />);

      // Should show some time remaining (days/hours/minutes format)
      const lockTimeElement = screen.getByText(/\d+[dhm]/);
      expect(lockTimeElement).toBeInTheDocument();
    });
  });
});
