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

  it('shows the payments address as plain text with no mailto link', () => {
    render(<UnpaidPaymentNotice unpaidCount={1} email="player@example.com" />);

    // Interac e-transfers go through the user's bank — there must be no
    // mailto link / "email" button suggesting otherwise.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/email payment to/i)).not.toBeInTheDocument();
    // The address is still shown (twice: body + how-to-pay instruction).
    expect(screen.getAllByText(PAYMENTS_EMAIL).length).toBeGreaterThan(0);
    expect(screen.getByText(/how to pay/i)).toBeInTheDocument();
    expect(screen.getByText(/through your bank/i)).toBeInTheDocument();
  });

  it('falls back to a generic email label when none is supplied', () => {
    render(<UnpaidPaymentNotice unpaidCount={1} email={null} />);
    expect(screen.getAllByText(/your registered email/i).length).toBeGreaterThan(0);
  });
});
