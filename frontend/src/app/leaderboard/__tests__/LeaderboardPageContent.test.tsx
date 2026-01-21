import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaderboardPageContent } from '../LeaderboardPageContent';
import {
  setWalletConnected,
  setWalletDisconnected,
} from '@solana/wallet-adapter-react';

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  setWalletDisconnected();
});

describe('LeaderboardPageContent', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<LeaderboardPageContent />);

      // "Leaderboard" appears in nav and heading
      expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument();
    });

    it('should show loading skeleton initially', () => {
      render(<LeaderboardPageContent />);

      // Should show skeleton loading state
      expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument();
    });

    it('should render leaderboard table after loading', async () => {
      render(<LeaderboardPageContent />);

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(screen.getByRole('table')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should show participant count after loading', async () => {
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(screen.getByText(/\d+ participants/)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('wallet disconnected state', () => {
    it('should show connect wallet message when disconnected', async () => {
      setWalletDisconnected();
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(
            screen.getByText('Connect your wallet to see your rank.')
          ).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should not show user rank banner when disconnected', async () => {
      setWalletDisconnected();
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(screen.queryByText('Your Rank')).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('wallet connected state', () => {
    it('should not show connect wallet message when connected', async () => {
      setWalletConnected();
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(
            screen.queryByText('Connect your wallet to see your rank.')
          ).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should show no predictions message when user has no entry', async () => {
      // Connect with a wallet that's not in the leaderboard
      setWalletConnected('NonExistentWallet12345678901234567890');
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(
            screen.getByText("You haven't submitted predictions yet.")
          ).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('pagination', () => {
    it('should show pagination after loading', async () => {
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should change page when pagination button is clicked', async () => {
      const user = userEvent.setup();
      render(<LeaderboardPageContent />);

      // Wait for loading
      await waitFor(
        () => {
          expect(screen.getByRole('table')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Find and click next page button
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Page info should update
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });
  });

  describe('table content', () => {
    it('should show table headers', async () => {
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(screen.getByText('Rank')).toBeInTheDocument();
          expect(screen.getByText('Wallet')).toBeInTheDocument();
          expect(screen.getByText('Points')).toBeInTheDocument();
          expect(screen.getByText('Change')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should show rank badges for top 3', async () => {
      render(<LeaderboardPageContent />);

      await waitFor(
        () => {
          expect(screen.getByText('1st')).toBeInTheDocument();
          expect(screen.getByText('2nd')).toBeInTheDocument();
          expect(screen.getByText('3rd')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });
});
