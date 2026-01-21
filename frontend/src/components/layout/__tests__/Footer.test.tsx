import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';

describe('Footer', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<Footer />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('should render branding text', () => {
      render(<Footer />);

      expect(screen.getByText('WC2026 Prediction Game')).toBeInTheDocument();
      expect(screen.getByText('Decentralized predictions on Solana')).toBeInTheDocument();
    });

    it('should render copyright text with current year', () => {
      render(<Footer />);

      const currentYear = new Date().getFullYear();
      expect(
        screen.getByText(new RegExp(`${currentYear}.*World Cup 2026 Prediction Game`))
      ).toBeInTheDocument();
    });
  });

  describe('navigation links', () => {
    it('should render About link', () => {
      render(<Footer />);

      const aboutLink = screen.getByRole('link', { name: 'About' });
      expect(aboutLink).toBeInTheDocument();
      expect(aboutLink).toHaveAttribute('href', '/about');
    });

    it('should render Rules link', () => {
      render(<Footer />);

      const rulesLink = screen.getByRole('link', { name: 'Rules' });
      expect(rulesLink).toBeInTheDocument();
      expect(rulesLink).toHaveAttribute('href', '/rules');
    });

    it('should render Terms link', () => {
      render(<Footer />);

      const termsLink = screen.getByRole('link', { name: 'Terms' });
      expect(termsLink).toBeInTheDocument();
      expect(termsLink).toHaveAttribute('href', '/terms');
    });

    it('should render Privacy link', () => {
      render(<Footer />);

      const privacyLink = screen.getByRole('link', { name: 'Privacy' });
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).toHaveAttribute('href', '/privacy');
    });
  });

  describe('structure', () => {
    it('should contain all four footer links', () => {
      render(<Footer />);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(4);
    });

    it('should have navigation element for links', () => {
      render(<Footer />);

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });
  });
});
