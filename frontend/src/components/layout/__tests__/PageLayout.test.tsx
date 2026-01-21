import { render, screen } from '@testing-library/react';
import { PageLayout } from '../PageLayout';

describe('PageLayout', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(
        <PageLayout>
          <div>Test content</div>
        </PageLayout>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should render children in main element', () => {
      render(
        <PageLayout>
          <div data-testid="child-content">Child component</div>
        </PageLayout>
      );

      const main = screen.getByRole('main');
      expect(main).toContainElement(screen.getByTestId('child-content'));
    });

    it('should include Header component', () => {
      render(
        <PageLayout>
          <div>Content</div>
        </PageLayout>
      );

      // Header should be present (check for banner role or specific header content)
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should include Footer component', () => {
      render(
        <PageLayout>
          <div>Content</div>
        </PageLayout>
      );

      // Footer should be present (check for contentinfo role)
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });
  });

  describe('structure', () => {
    it('should render Header, main, and Footer in correct order', () => {
      render(
        <PageLayout>
          <div>Main content</div>
        </PageLayout>
      );

      const header = screen.getByRole('banner');
      const main = screen.getByRole('main');
      const footer = screen.getByRole('contentinfo');

      // Check that all elements exist
      expect(header).toBeInTheDocument();
      expect(main).toBeInTheDocument();
      expect(footer).toBeInTheDocument();

      // Verify the DOM structure order by checking their positions
      const container = header.parentElement;
      expect(container).not.toBeNull();

      const children = Array.from(container!.children);
      const headerIndex = children.indexOf(header);
      const mainIndex = children.indexOf(main);
      const footerIndex = children.indexOf(footer);

      expect(headerIndex).toBeLessThan(mainIndex);
      expect(mainIndex).toBeLessThan(footerIndex);
    });
  });

  describe('multiple children', () => {
    it('should render multiple children', () => {
      render(
        <PageLayout>
          <div>First child</div>
          <div>Second child</div>
          <div>Third child</div>
        </PageLayout>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
      expect(screen.getByText('Third child')).toBeInTheDocument();
    });
  });

  describe('flex layout', () => {
    it('should have flex layout for full height', () => {
      const { container } = render(
        <PageLayout>
          <div>Content</div>
        </PageLayout>
      );

      // The root div should have flex classes
      const rootDiv = container.firstChild;
      expect(rootDiv).toHaveClass('flex', 'flex-col', 'min-h-screen');
    });

    it('should have flex-1 on main for growing', () => {
      render(
        <PageLayout>
          <div>Content</div>
        </PageLayout>
      );

      const main = screen.getByRole('main');
      expect(main).toHaveClass('flex-1');
    });
  });
});
