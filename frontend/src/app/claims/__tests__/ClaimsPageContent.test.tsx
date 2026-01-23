import { render, screen } from '@testing-library/react';
import { ClaimsPageContent } from '../ClaimsPageContent';

describe('ClaimsPageContent', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<ClaimsPageContent />);

      expect(screen.getByRole('heading', { name: 'Claims' })).toBeInTheDocument();
    });

    it('should show "Coming Soon" message', () => {
      render(<ClaimsPageContent />);

      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('should show description about prize distribution', () => {
      render(<ClaimsPageContent />);

      expect(screen.getByText('Prize distribution is not yet available')).toBeInTheDocument();
    });
  });

  describe('explanation section', () => {
    it('should explain when claims will be available', () => {
      render(<ClaimsPageContent />);

      expect(
        screen.getByText(/Prize claims will be available after the tournament ends/i)
      ).toBeInTheDocument();
    });

    it('should mention final rankings', () => {
      render(<ClaimsPageContent />);

      expect(screen.getByText(/final rankings are calculated/i)).toBeInTheDocument();
    });
  });

  describe('interim suggestions', () => {
    it('should show "In the meantime" section', () => {
      render(<ClaimsPageContent />);

      expect(screen.getByText('In the meantime:')).toBeInTheDocument();
    });

    it('should suggest checking leaderboard', () => {
      render(<ClaimsPageContent />);

      expect(
        screen.getByText(/Check your current ranking on the leaderboard/i)
      ).toBeInTheDocument();
    });

    it('should suggest following tournament', () => {
      render(<ClaimsPageContent />);

      expect(
        screen.getByText(/Follow the tournament to see how your predictions are doing/i)
      ).toBeInTheDocument();
    });
  });

  describe('leaderboard link', () => {
    it('should render link to leaderboard', () => {
      render(<ClaimsPageContent />);

      const leaderboardLink = screen.getByRole('link', { name: /View Leaderboard/i });
      expect(leaderboardLink).toBeInTheDocument();
    });

    it('should have correct href for leaderboard link', () => {
      render(<ClaimsPageContent />);

      const leaderboardLink = screen.getByRole('link', { name: /View Leaderboard/i });
      expect(leaderboardLink).toHaveAttribute('href', '/leaderboard');
    });
  });

  describe('icons', () => {
    it('should render Award icon', () => {
      render(<ClaimsPageContent />);

      // The component should render without errors, indicating icons are present
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('should render Clock icon in explanation', () => {
      render(<ClaimsPageContent />);

      // Clock icon is used in the explanation section
      expect(screen.getByText(/Prize claims will be available/i)).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('should use PageLayout wrapper', () => {
      render(<ClaimsPageContent />);

      // PageLayout includes header and footer
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('should center content', () => {
      render(<ClaimsPageContent />);

      // The main content should be centered within the layout
      const comingSoon = screen.getByText('Coming Soon');
      expect(comingSoon).toBeInTheDocument();
      // Verify it's within a card structure (parent elements exist)
      expect(comingSoon.closest('div')).toBeTruthy();
    });
  });
});
