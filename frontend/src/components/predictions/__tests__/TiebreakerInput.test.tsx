import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TiebreakerInput } from '../TiebreakerInput';

describe('TiebreakerInput', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      expect(screen.getByText('Tiebreaker: Total Goals')).toBeInTheDocument();
    });

    it('should render label and input', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      expect(screen.getByLabelText('Total Goals Prediction')).toBeInTheDocument();
    });

    it('should render description text', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      expect(
        screen.getByText(/Predict the total number of goals scored/i)
      ).toBeInTheDocument();
    });

    it('should render help text', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      expect(screen.getByText(/How it works:/i)).toBeInTheDocument();
      expect(screen.getByText(/tiebreaker determines rankings/i)).toBeInTheDocument();
    });

    it('should show placeholder text', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      expect(input).toHaveAttribute('placeholder', 'Enter a number (100-300)');
    });
  });

  describe('initial value', () => {
    it('should show empty input when value is null', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      expect(input).toHaveValue(null);
    });

    it('should show value when provided', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={172} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      expect(input).toHaveValue(172);
    });
  });

  describe('validation', () => {
    it('should allow valid input within range', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      await user.type(input, '150');

      expect(mockOnChange).toHaveBeenLastCalledWith(150);
      expect(screen.queryByText(/must be between/i)).not.toBeInTheDocument();
    });

    it('should show error for value below minimum', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      await user.type(input, '50');

      expect(screen.getByText(/Goals must be between 100 and 300/i)).toBeInTheDocument();
      expect(mockOnChange).toHaveBeenLastCalledWith(null);
    });

    it('should show error for value above maximum', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      await user.type(input, '350');

      expect(screen.getByText(/Goals must be between 100 and 300/i)).toBeInTheDocument();
      expect(mockOnChange).toHaveBeenLastCalledWith(null);
    });

    it('should show error for negative numbers', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      await user.clear(input);
      await user.type(input, '-10');

      // Should show error about positive number or range
      expect(
        screen.queryByText(/must be a positive number/i) ||
          screen.queryByText(/must be between/i)
      ).toBeTruthy();
    });

    it('should handle empty input after clearing', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={150} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      await user.clear(input);

      // Clearing should call onChange with null
      expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    it('should clear error when input is cleared', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');

      // Enter invalid value
      await user.type(input, '50');
      expect(screen.getByText(/Goals must be between/i)).toBeInTheDocument();

      // Clear input
      await user.clear(input);
      expect(screen.queryByText(/Goals must be between/i)).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} disabled={true} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      expect(input).toBeDisabled();
    });

    it('should not disable input when disabled prop is false', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} disabled={false} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      expect(input).not.toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have aria-describedby for help and error', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      expect(input).toHaveAttribute('aria-describedby', 'tiebreaker-help tiebreaker-error');
    });

    it('should set aria-invalid when there is an error', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={null} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      await user.type(input, '50');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not have aria-invalid when input is valid', () => {
      const mockOnChange = jest.fn();
      render(<TiebreakerInput value={172} onChange={mockOnChange} />);

      const input = screen.getByLabelText('Total Goals Prediction');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('visual feedback', () => {
    it('should show green border when valid', () => {
      const mockOnChange = jest.fn();
      const { container } = render(
        <TiebreakerInput value={172} onChange={mockOnChange} />
      );

      // Card should have green styling when valid
      const card = container.querySelector('[class*="border-green"]');
      expect(card).toBeTruthy();
    });
  });
});
