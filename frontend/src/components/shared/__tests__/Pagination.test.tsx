import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from '../Pagination';

describe('Pagination', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={1} totalPages={10} onPageChange={mockOnChange} />);

      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });

    it('should render previous and next buttons', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={5} totalPages={10} onPageChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    });

    it('should show page info', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={3} totalPages={10} onPageChange={mockOnChange} />);

      expect(screen.getByText('Page 3 of 10')).toBeInTheDocument();
    });
  });

  describe('page numbers', () => {
    it('should show all pages when total is small', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={1} totalPages={5} onPageChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 3' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 4' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 5' })).toBeInTheDocument();
    });

    it('should show ellipsis for large page counts', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={5} totalPages={20} onPageChange={mockOnChange} />);

      // Should show ellipsis elements
      const ellipses = screen.getAllByRole('generic', { hidden: true });
      expect(ellipses.length).toBeGreaterThan(0);
    });

    it('should always show first and last pages', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={5} totalPages={20} onPageChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 20' })).toBeInTheDocument();
    });

    it('should show pages around current page', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={10} totalPages={20} onPageChange={mockOnChange} />);

      // Should show pages around current page (9, 10, 11)
      expect(screen.getByRole('button', { name: 'Go to page 9' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 10' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 11' })).toBeInTheDocument();
    });
  });

  describe('current page highlighting', () => {
    it('should highlight current page button', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={3} totalPages={5} onPageChange={mockOnChange} />);

      const currentPageButton = screen.getByRole('button', { name: 'Go to page 3' });
      expect(currentPageButton).toHaveAttribute('aria-current', 'page');
    });

    it('should disable current page button', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={3} totalPages={5} onPageChange={mockOnChange} />);

      const currentPageButton = screen.getByRole('button', { name: 'Go to page 3' });
      expect(currentPageButton).toBeDisabled();
    });
  });

  describe('navigation buttons', () => {
    it('should disable previous button on first page', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={1} totalPages={10} onPageChange={mockOnChange} />);

      const prevButton = screen.getByRole('button', { name: /previous page/i });
      expect(prevButton).toBeDisabled();
    });

    it('should enable previous button when not on first page', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={5} totalPages={10} onPageChange={mockOnChange} />);

      const prevButton = screen.getByRole('button', { name: /previous page/i });
      expect(prevButton).not.toBeDisabled();
    });

    it('should disable next button on last page', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={10} totalPages={10} onPageChange={mockOnChange} />);

      const nextButton = screen.getByRole('button', { name: /next page/i });
      expect(nextButton).toBeDisabled();
    });

    it('should enable next button when not on last page', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={5} totalPages={10} onPageChange={mockOnChange} />);

      const nextButton = screen.getByRole('button', { name: /next page/i });
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('interaction', () => {
    it('should call onPageChange with previous page when clicking previous', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={5} totalPages={10} onPageChange={mockOnChange} />);

      const prevButton = screen.getByRole('button', { name: /previous page/i });
      await user.click(prevButton);

      expect(mockOnChange).toHaveBeenCalledWith(4);
    });

    it('should call onPageChange with next page when clicking next', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={5} totalPages={10} onPageChange={mockOnChange} />);

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      expect(mockOnChange).toHaveBeenCalledWith(6);
    });

    it('should call onPageChange with specific page when clicking page number', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={1} totalPages={5} onPageChange={mockOnChange} />);

      const page3Button = screen.getByRole('button', { name: 'Go to page 3' });
      await user.click(page3Button);

      expect(mockOnChange).toHaveBeenCalledWith(3);
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const mockOnChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnChange}
          className="custom-class"
        />
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('custom-class');
    });
  });

  describe('edge cases', () => {
    it('should handle single page', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={1} totalPages={1} onPageChange={mockOnChange} />);

      const prevButton = screen.getByRole('button', { name: /previous page/i });
      const nextButton = screen.getByRole('button', { name: /next page/i });

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    });

    it('should handle page at start with ellipsis', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={2} totalPages={20} onPageChange={mockOnChange} />);

      // Should show pages 1, 2, 3 and last page
      expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 3' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 20' })).toBeInTheDocument();
    });

    it('should handle page at end with ellipsis', () => {
      const mockOnChange = jest.fn();
      render(<Pagination currentPage={19} totalPages={20} onPageChange={mockOnChange} />);

      // Should show pages 1, and 18, 19, 20
      expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 18' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 19' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go to page 20' })).toBeInTheDocument();
    });
  });

  describe('DEFAULT_ITEMS_PER_PAGE', () => {
    it('should export default items per page constant', () => {
      expect(DEFAULT_ITEMS_PER_PAGE).toBe(25);
    });
  });
});
