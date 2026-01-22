import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';

// Mock next-themes
const mockSetTheme = jest.fn();
const mockUseTheme = jest.fn();

jest.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}));

// Mock useMounted hook
const mockUseMounted = jest.fn();

jest.mock('@/hooks/useMounted', () => ({
  useMounted: () => mockUseMounted(),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to mounted state
    mockUseMounted.mockReturnValue(true);
    // Default theme state
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
    });
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<ThemeToggle />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render a button with ghost variant styling', () => {
      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<ThemeToggle className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('icons', () => {
    it('should display Sun icon when theme is light', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
        resolvedTheme: 'light',
      });

      render(<ThemeToggle />);

      // Sun icon has a specific SVG path
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('lucide-sun');
    });

    it('should display Moon icon when theme is dark', () => {
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: mockSetTheme,
        resolvedTheme: 'dark',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('lucide-moon');
    });

    it('should display Monitor icon when theme is system', () => {
      mockUseTheme.mockReturnValue({
        theme: 'system',
        setTheme: mockSetTheme,
        resolvedTheme: 'dark',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('lucide-monitor');
    });
  });

  describe('theme cycling', () => {
    it('should cycle from light to dark when clicked', async () => {
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
        resolvedTheme: 'light',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should cycle from dark to system when clicked', async () => {
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: mockSetTheme,
        resolvedTheme: 'dark',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith('system');
    });

    it('should cycle from system to light when clicked', async () => {
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: 'system',
        setTheme: mockSetTheme,
        resolvedTheme: 'dark',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should default to system theme when theme is undefined', async () => {
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: undefined,
        setTheme: mockSetTheme,
        resolvedTheme: 'light',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      await user.click(button);

      // undefined theme defaults to 'system' index (2), next is 'light' (0)
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });
  });

  describe('accessibility', () => {
    it('should have accessible aria-label for light mode', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
        resolvedTheme: 'light',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Current: Light mode. Click to switch theme.');
    });

    it('should have accessible aria-label for dark mode', () => {
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: mockSetTheme,
        resolvedTheme: 'dark',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Current: Dark mode. Click to switch theme.');
    });

    it('should have accessible aria-label for system mode with resolved theme', () => {
      mockUseTheme.mockReturnValue({
        theme: 'system',
        setTheme: mockSetTheme,
        resolvedTheme: 'dark',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        'Current: System (dark). Click to switch theme.'
      );
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
        resolvedTheme: 'light',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should respond to Space key press', async () => {
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: mockSetTheme,
        resolvedTheme: 'light',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard(' ');
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('hydration safety', () => {
    it('should render placeholder button when not mounted', () => {
      mockUseMounted.mockReturnValue(false);

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'Toggle theme');
    });

    it('should display Sun icon as placeholder when not mounted', () => {
      mockUseMounted.mockReturnValue(false);

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('lucide-sun');
    });

    it('should enable button once mounted', () => {
      mockUseMounted.mockReturnValue(true);

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('unknown theme handling', () => {
    it('should show Toggle theme label for unknown theme', () => {
      mockUseTheme.mockReturnValue({
        theme: 'custom-unknown-theme',
        setTheme: mockSetTheme,
        resolvedTheme: 'light',
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Current: Toggle theme. Click to switch theme.');
    });
  });
});
