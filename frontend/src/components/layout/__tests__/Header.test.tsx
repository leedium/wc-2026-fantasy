import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../Header';

// Mock usePathname
const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => mockUsePathname(),
}));

describe('Header', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<Header />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should render the logo/brand', () => {
      render(<Header />);
      expect(screen.getByText('WC2026')).toBeInTheDocument();
    });

    it('should render navigation links', () => {
      render(<Header />);

      // Desktop navigation links
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Predictions' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Leaderboard' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Claims' })).toBeInTheDocument();
    });

    it('should render wallet button', () => {
      render(<Header />);

      // Wallet button should be present (mocked) - renders twice (desktop and mobile)
      const walletButtons = screen.getAllByTestId('wallet-multi-button');
      expect(walletButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should render mobile menu button', () => {
      render(<Header />);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toBeInTheDocument();
    });
  });

  describe('navigation links', () => {
    it('should have correct href for Home link', () => {
      render(<Header />);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('should have correct href for Predictions link', () => {
      render(<Header />);

      const predictionsLink = screen.getByRole('link', { name: 'Predictions' });
      expect(predictionsLink).toHaveAttribute('href', '/predictions');
    });

    it('should have correct href for Leaderboard link', () => {
      render(<Header />);

      const leaderboardLink = screen.getByRole('link', { name: 'Leaderboard' });
      expect(leaderboardLink).toHaveAttribute('href', '/leaderboard');
    });

    it('should have correct href for Claims link', () => {
      render(<Header />);

      const claimsLink = screen.getByRole('link', { name: 'Claims' });
      expect(claimsLink).toHaveAttribute('href', '/claims');
    });
  });

  describe('active state', () => {
    it('should highlight Home when on root path', () => {
      mockUsePathname.mockReturnValue('/');
      render(<Header />);

      // The home link should be styled differently when active
      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveClass('font-semibold');
    });

    it('should highlight Predictions when on predictions path', () => {
      mockUsePathname.mockReturnValue('/predictions');
      render(<Header />);

      const predictionsLink = screen.getByRole('link', { name: 'Predictions' });
      expect(predictionsLink).toHaveClass('font-semibold');
    });

    it('should highlight Leaderboard when on leaderboard path', () => {
      mockUsePathname.mockReturnValue('/leaderboard');
      render(<Header />);

      const leaderboardLink = screen.getByRole('link', { name: 'Leaderboard' });
      expect(leaderboardLink).toHaveClass('font-semibold');
    });

    it('should highlight Claims when on claims path', () => {
      mockUsePathname.mockReturnValue('/claims');
      render(<Header />);

      const claimsLink = screen.getByRole('link', { name: 'Claims' });
      expect(claimsLink).toHaveClass('font-semibold');
    });

    it('should not highlight Home when on other paths', () => {
      mockUsePathname.mockReturnValue('/predictions');
      render(<Header />);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      // Home should not have active styling when on /predictions
      expect(homeLink).not.toHaveClass('bg-accent');
    });
  });

  describe('mobile menu', () => {
    it('should open mobile menu when menu button is clicked', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // Sheet content should be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });

    it('should show navigation links in mobile menu', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // Mobile navigation links should be in the sheet
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Home');
      expect(dialog).toHaveTextContent('Predictions');
      expect(dialog).toHaveTextContent('Leaderboard');
      expect(dialog).toHaveTextContent('Claims');
    });
  });

  describe('logo link', () => {
    it('should link logo to home page', () => {
      render(<Header />);

      const logoLink = screen.getByRole('link', { name: 'WC2026' });
      expect(logoLink).toHaveAttribute('href', '/');
    });
  });
});
