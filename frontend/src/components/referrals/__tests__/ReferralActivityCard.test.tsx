import { render, screen } from '@testing-library/react';

import { ReferralActivityCard } from '../ReferralActivityCard';
import type { RewardsStatus } from '@/hooks/useRewardsStatus';

jest.mock('@/hooks/useRewardsStatus', () => ({
  useRewardsStatus: jest.fn(),
}));

import { useRewardsStatus } from '@/hooks/useRewardsStatus';

const mockedUseRewardsStatus = useRewardsStatus as jest.MockedFunction<
  typeof useRewardsStatus
>;

function status(overrides: Partial<RewardsStatus['referral']>): RewardsStatus {
  return {
    referralCode: 'ABCD2345',
    totalAvailable: 0,
    referral: {
      available: 0,
      qualifiedTotal: 0,
      earned: 0,
      redeemedTotal: 0,
      ...overrides,
    },
    loyalty: { available: 0, earned: 0, redeemed: 0, cashPaid: 0 },
  };
}

describe('ReferralActivityCard', () => {
  beforeEach(() => {
    mockedUseRewardsStatus.mockReset();
  });

  it('hides the progress line when no friends have paid yet', () => {
    mockedUseRewardsStatus.mockReturnValue({
      status: status({ qualifiedTotal: 0 }),
      isLoading: false,
      refetch: jest.fn(),
    });
    render(<ReferralActivityCard />);
    expect(screen.queryByText(/toward your next free pick/i)).not.toBeInTheDocument();
  });

  it('shows "3/4 toward your next free pick" with 3 paid referrals', () => {
    mockedUseRewardsStatus.mockReturnValue({
      status: status({ qualifiedTotal: 3, earned: 0, available: 0 }),
      isLoading: false,
      refetch: jest.fn(),
    });
    render(<ReferralActivityCard />);
    const progress = screen.getByText(/toward your next free pick/i);
    expect(progress).toHaveTextContent('3/4');
  });

  it('shows "0/4 toward your next free pick" right after a credit unlocks at 4', () => {
    mockedUseRewardsStatus.mockReturnValue({
      status: status({ qualifiedTotal: 4, earned: 1, available: 1 }),
      isLoading: false,
      refetch: jest.fn(),
    });
    render(<ReferralActivityCard />);
    expect(screen.getByText(/toward your next free pick/i)).toHaveTextContent('0/4');
  });
});
