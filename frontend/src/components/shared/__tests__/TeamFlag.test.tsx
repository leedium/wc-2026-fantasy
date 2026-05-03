import { render } from '@testing-library/react';
import { TeamFlag } from '../TeamFlag';

describe('TeamFlag', () => {
  it('renders an svg for a known FIFA code', () => {
    const { container } = render(<TeamFlag code="BRA" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the GB England subdivision for ENG', () => {
    const { container } = render(<TeamFlag code="ENG" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders nothing for an unknown code', () => {
    const { container } = render(<TeamFlag code="XYZ" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('is case-insensitive on the FIFA code', () => {
    const { container } = render(<TeamFlag code="bra" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
