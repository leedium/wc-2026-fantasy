import { render, screen } from '@testing-library/react';
import Home from '../page';

describe('Home Page', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<Home />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should render hero section', () => {
      render(<Home />);

      expect(screen.getByText('FIFA World Cup 2026')).toBeInTheDocument();
      expect(screen.getByText('World Cup 2026')).toBeInTheDocument();
      expect(screen.getByText('Prediction Game')).toBeInTheDocument();
    });

    it('should render main call to action buttons', () => {
      render(<Home />);

      const predictionLinks = screen.getAllByRole('link', { name: /Make Your Predictions/i });
      expect(predictionLinks.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('link', { name: 'View Leaderboard' })).toBeInTheDocument();
    });

    it('should render tournament overview section', () => {
      render(<Home />);

      expect(screen.getByText('Tournament Overview')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Entry Fee')).toBeInTheDocument();
      expect(screen.getByText('Prize Pool')).toBeInTheDocument();
      expect(screen.getByText('Total Entries')).toBeInTheDocument();
      expect(screen.getByText('Lock Time')).toBeInTheDocument();
    });

    it('should render how it works section', () => {
      render(<Home />);

      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      expect(screen.getByText('Make Predictions')).toBeInTheDocument();
      expect(screen.getByText('Earn Points')).toBeInTheDocument();
      expect(screen.getByText('Claim Prizes')).toBeInTheDocument();
    });

    it('should render scoring breakdown section', () => {
      render(<Home />);

      expect(screen.getByText('Scoring Breakdown')).toBeInTheDocument();
      // Multiple instances of Group Stage and Knockout Stage across the page
      expect(screen.getAllByText(/Group Stage/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Knockout Stage/i).length).toBeGreaterThanOrEqual(1);
    });

    it('should render CTA section', () => {
      render(<Home />);

      expect(screen.getByText('Ready to Compete?')).toBeInTheDocument();
    });
  });

  describe('navigation links', () => {
    it('should have correct href for predictions link', () => {
      render(<Home />);

      const predictionLinks = screen.getAllByRole('link', { name: /Make Your Predictions/i });
      expect(predictionLinks[0]).toHaveAttribute('href', '/predictions');
    });

    it('should have correct href for leaderboard link', () => {
      render(<Home />);

      const leaderboardLink = screen.getByRole('link', { name: 'View Leaderboard' });
      expect(leaderboardLink).toHaveAttribute('href', '/leaderboard');
    });
  });

  describe('tournament status', () => {
    it('should display tournament status badge', () => {
      render(<Home />);

      // The status should be displayed (upcoming, active, or completed)
      const statusText = screen.getByText(/Upcoming|Live|Completed/i);
      expect(statusText).toBeInTheDocument();
    });

    it('should display entry fee', () => {
      render(<Home />);

      expect(screen.getByText('0.1 SOL')).toBeInTheDocument();
    });

    it('should display time remaining format', () => {
      render(<Home />);

      // Should show time in format like "5d 12h 30m" or similar
      const timeText = screen.getByText(/\d+[dhm]/);
      expect(timeText).toBeInTheDocument();
    });
  });

  describe('scoring information', () => {
    it('should display group stage scoring', () => {
      render(<Home />);

      expect(screen.getByText('Correct 1st place')).toBeInTheDocument();
      expect(screen.getByText('+5 points')).toBeInTheDocument();
      expect(screen.getByText('Correct 2nd place')).toBeInTheDocument();
      expect(screen.getByText('+3 points')).toBeInTheDocument();
    });

    it('should display knockout stage scoring', () => {
      render(<Home />);

      expect(screen.getByText(/Round of 32/i)).toBeInTheDocument();
      expect(screen.getByText(/Quarter-finals/i)).toBeInTheDocument();
      expect(screen.getByText(/Semi-finals/i)).toBeInTheDocument();
      expect(screen.getByText('Final')).toBeInTheDocument();
    });

    it('should display maximum points', () => {
      render(<Home />);

      expect(screen.getByText('Maximum Group Points')).toBeInTheDocument();
      expect(screen.getByText('Maximum Knockout Points')).toBeInTheDocument();
      expect(screen.getByText('Maximum Total Points')).toBeInTheDocument();
    });

    it('should display tiebreaker information', () => {
      render(<Home />);

      expect(screen.getByText('Tiebreaker')).toBeInTheDocument();
      expect(screen.getByText(/Predict total tournament goals/i)).toBeInTheDocument();
    });
  });
});
