import { render, screen } from '@testing-library/react';
import { PrizeTables } from '../PrizeTables';

describe('PrizeTables', () => {
  it('renders both phase headings', () => {
    render(<PrizeTables />);
    expect(screen.getByText('Phase 1 — Group Stage')).toBeInTheDocument();
    expect(screen.getByText('Phase 2 — Knockout')).toBeInTheDocument();
  });

  it('renders the Phase 1 (top 3) prize amounts', () => {
    render(<PrizeTables />);
    expect(screen.getByText('$200')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('renders the Phase 2 (top 5) prize amounts including 4th and 5th', () => {
    render(<PrizeTables />);
    expect(screen.getByText('$2,000')).toBeInTheDocument();
    expect(screen.getByText('$700')).toBeInTheDocument();
    expect(screen.getByText('$215')).toBeInTheDocument();
    expect(screen.getByText('$142')).toBeInTheDocument();
  });

  it('shows place badges through 5th', () => {
    render(<PrizeTables />);
    // 4th/5th only exist in Phase 2; 1st–3rd appear in both phases.
    expect(screen.getByText('4th')).toBeInTheDocument();
    expect(screen.getByText('5th')).toBeInTheDocument();
    expect(screen.getAllByText('1st')).toHaveLength(2);
  });

  it('flags the active phase with an "Active now" badge', () => {
    render(<PrizeTables activePhase="phase2" />);
    expect(screen.getByText('Active now')).toBeInTheDocument();
  });

  it('renders no active badge when activePhase is omitted', () => {
    render(<PrizeTables />);
    expect(screen.queryByText('Active now')).not.toBeInTheDocument();
  });

  it('shows the charity / management-fee deduction footnote with links', () => {
    render(<PrizeTables />);
    expect(screen.getByRole('link', { name: 'charity' })).toHaveAttribute('href', '/charities');
    expect(screen.getByRole('link', { name: 'management fees' })).toHaveAttribute(
      'href',
      '/audit'
    );
  });
});
