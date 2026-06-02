import { render, screen } from '@testing-library/react';

import { UnpaidPaymentNotice } from '../UnpaidPaymentNotice';
import { PAYMENTS_EMAIL, PRICING } from '@/lib/constants';

describe('UnpaidPaymentNotice', () => {
  it('renders nothing when there are no unpaid predictions', () => {
    const { container } = render(
      <UnpaidPaymentNotice unpaidCount={0} email="player@example.com" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the count, registered email, and total due', () => {
    render(<UnpaidPaymentNotice unpaidCount={2} email="player@example.com" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/2 unpaid predictions/i)).toBeInTheDocument();
    expect(screen.getByText('player@example.com')).toBeInTheDocument();
    // total due = count * entry fee
    expect(
      screen.getByText(`$${2 * PRICING.entryFeeCAD} ${PRICING.currency}`)
    ).toBeInTheDocument();
  });

  it('uses singular copy for a single unpaid prediction', () => {
    render(<UnpaidPaymentNotice unpaidCount={1} email="player@example.com" />);
    expect(screen.getByText(/1 unpaid prediction(?!s)/i)).toBeInTheDocument();
  });

  it('links to the payments email and falls back when email is null', () => {
    render(<UnpaidPaymentNotice unpaidCount={1} email={null} />);

    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith(`mailto:${PAYMENTS_EMAIL}`));
    expect(links.length).toBeGreaterThan(0);
    // The (<email>) label falls back to this phrase when no email is supplied.
    expect(screen.getAllByText(/your registered email/i).length).toBeGreaterThan(0);
  });
});
