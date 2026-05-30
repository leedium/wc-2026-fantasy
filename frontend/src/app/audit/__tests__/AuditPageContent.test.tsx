import { render, screen } from '@testing-library/react';

const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: unknown) => mockUseQuery(opts),
}));
jest.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AuditPageContent } from '../AuditPageContent';
import { computeAuditAccounting } from '@/lib/audit';
import { OPERATING_COSTS, PRICING } from '@/lib/constants';
import { formatCAD } from '@/lib/currency';

function netDisplay(c: typeof counts): string {
  const net = computeAuditAccounting(c, { pricing: PRICING, costs: OPERATING_COSTS }).netPayout;
  const sign = net < 0 ? '−' : '';
  return `${sign}${formatCAD(Math.abs(net), { cents: true })}`;
}

const counts = {
  tournament: { id: 't1', status: 'group_stage', lockTime: null },
  totalRegistrations: 50,
  usersWithPaidPrediction: 20,
  totalEntries: 25,
  cashPaidCount: 22,
  freeEntries: 3,
  referralCreditsRedeemed: 2,
  loyaltyCreditsRedeemed: 1,
};

describe('AuditPageContent', () => {
  beforeEach(() => mockUseQuery.mockReset());

  it('renders the dashboard stats and accounting ledger', () => {
    mockUseQuery.mockReturnValue({ data: counts, isLoading: false, isError: false });
    render(<AuditPageContent />);

    // Dashboard cards
    expect(screen.getByText('Total members')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Paid members')).toBeInTheDocument();
    expect(screen.getByText('$660')).toBeInTheDocument(); // 22 × $30 revenue
    // Applied rewards = referral 2 + loyalty 1
    expect(screen.getByText(/Referral 2 · Loyalty 1/)).toBeInTheDocument();

    // Formal ledger
    expect(screen.getByText('Gross income')).toBeInTheDocument();
    expect(screen.getByText('Charity')).toBeInTheDocument();
    expect(screen.getByText('Total costs')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
  });

  it('colors Net green when positive and red when negative', () => {
    // Healthy pool → positive net, green.
    const positive = { ...counts, cashPaidCount: 200 };
    mockUseQuery.mockReturnValue({ data: positive, isLoading: false, isError: false });
    const { unmount } = render(<AuditPageContent />);
    expect(screen.getByText(netDisplay(positive))).toHaveClass('text-green-700');
    unmount();

    // Tiny pool → costs exceed income, negative net, red.
    const negative = { ...counts, cashPaidCount: 5 };
    mockUseQuery.mockReturnValue({ data: negative, isLoading: false, isError: false });
    render(<AuditPageContent />);
    expect(screen.getByText(netDisplay(negative))).toHaveClass('text-red-600');
  });

  it('shows a loading state without crashing', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<AuditPageContent />);
    expect(screen.getByText('Total members')).toBeInTheDocument();
  });

  it('shows an error state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<AuditPageContent />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
