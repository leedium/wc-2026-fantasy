import { render, screen } from '@testing-library/react';
import { LeaderboardTable } from '../LeaderboardTable';
import type { LeaderboardEntry } from '@/types/tournament';

// Mock leaderboard data
const mockEntries: LeaderboardEntry[] = [
  {
    rank: 1,
    wallet: 'ABC123456789012345678901234567890123456789012',
    points: 250,
    change: 2,
    groupPoints: 100,
    knockoutPoints: 150,
  },
  {
    rank: 2,
    wallet: 'DEF123456789012345678901234567890123456789012',
    points: 230,
    change: -1,
    groupPoints: 90,
    knockoutPoints: 140,
  },
  {
    rank: 3,
    wallet: 'GHI123456789012345678901234567890123456789012',
    points: 210,
    change: 0,
    groupPoints: 85,
    knockoutPoints: 125,
  },
  {
    rank: 4,
    wallet: 'JKL123456789012345678901234567890123456789012',
    points: 190,
    change: 5,
    groupPoints: 80,
    knockoutPoints: 110,
  },
  {
    rank: 5,
    wallet: 'MNO123456789012345678901234567890123456789012',
    points: 170,
    change: -3,
    groupPoints: 75,
    knockoutPoints: 95,
  },
];

describe('LeaderboardTable', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<LeaderboardTable entries={mockEntries} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<LeaderboardTable entries={mockEntries} />);

      expect(screen.getByText('Rank')).toBeInTheDocument();
      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.getByText('Points')).toBeInTheDocument();
      expect(screen.getByText('Change')).toBeInTheDocument();
    });

    it('should render all entries', () => {
      render(<LeaderboardTable entries={mockEntries} />);

      // All entries should have their points displayed
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('230')).toBeInTheDocument();
      expect(screen.getByText('210')).toBeInTheDocument();
      expect(screen.getByText('190')).toBeInTheDocument();
      expect(screen.getByText('170')).toBeInTheDocument();
    });

    it('should render empty state when no entries', () => {
      render(<LeaderboardTable entries={[]} />);

      expect(screen.getByText('No entries found.')).toBeInTheDocument();
    });
  });

  describe('rank badges', () => {
    it('should show 1st badge for rank 1', () => {
      render(<LeaderboardTable entries={mockEntries} />);
      expect(screen.getByText('1st')).toBeInTheDocument();
    });

    it('should show 2nd badge for rank 2', () => {
      render(<LeaderboardTable entries={mockEntries} />);
      expect(screen.getByText('2nd')).toBeInTheDocument();
    });

    it('should show 3rd badge for rank 3', () => {
      render(<LeaderboardTable entries={mockEntries} />);
      expect(screen.getByText('3rd')).toBeInTheDocument();
    });

    it('should show plain number for ranks 4+', () => {
      render(<LeaderboardTable entries={mockEntries} />);
      // Ranks 4 and 5 should be shown as plain text
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('wallet display', () => {
    it('should truncate long wallet addresses', () => {
      render(<LeaderboardTable entries={mockEntries} />);

      // Wallet should be truncated to first 4 and last 4 characters
      // ABC1...9012
      expect(screen.getByText('ABC1...9012')).toBeInTheDocument();
    });

    it('should not truncate short wallet addresses', () => {
      const shortWalletEntry: LeaderboardEntry = {
        rank: 1,
        wallet: 'ShortWallet',
        points: 100,
        change: 0,
        groupPoints: 50,
        knockoutPoints: 50,
      };

      render(<LeaderboardTable entries={[shortWalletEntry]} />);
      expect(screen.getByText('ShortWallet')).toBeInTheDocument();
    });
  });

  describe('current user highlighting', () => {
    it('should highlight current user row', () => {
      const userWallet = 'ABC123456789012345678901234567890123456789012';
      render(<LeaderboardTable entries={mockEntries} currentUserWallet={userWallet} />);

      // Should show "(You)" indicator
      expect(screen.getByText('(You)')).toBeInTheDocument();
    });

    it('should match wallet case-insensitively', () => {
      const userWallet = 'abc123456789012345678901234567890123456789012';
      render(<LeaderboardTable entries={mockEntries} currentUserWallet={userWallet} />);

      expect(screen.getByText('(You)')).toBeInTheDocument();
    });

    it('should not highlight when currentUserWallet is null', () => {
      render(<LeaderboardTable entries={mockEntries} currentUserWallet={null} />);

      expect(screen.queryByText('(You)')).not.toBeInTheDocument();
    });

    it('should not highlight when currentUserWallet is not in entries', () => {
      render(<LeaderboardTable entries={mockEntries} currentUserWallet="NonExistentWallet123" />);

      expect(screen.queryByText('(You)')).not.toBeInTheDocument();
    });
  });

  describe('change indicators', () => {
    it('should show positive change with + sign', () => {
      render(<LeaderboardTable entries={mockEntries} />);

      // Entry with change: 2 should show +2
      expect(screen.getByText('+2')).toBeInTheDocument();
      // Entry with change: 5 should show +5
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should show negative change with - sign', () => {
      render(<LeaderboardTable entries={mockEntries} />);

      // Entry with change: -1 should show -1
      expect(screen.getByText('-1')).toBeInTheDocument();
      // Entry with change: -3 should show -3
      expect(screen.getByText('-3')).toBeInTheDocument();
    });

    it('should show dash for no change', () => {
      render(<LeaderboardTable entries={mockEntries} />);

      // Entry with change: 0 should show "-"
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('highlighted rank', () => {
    it('should highlight the specified rank', () => {
      render(<LeaderboardTable entries={mockEntries} highlightedRank={3} />);

      // Check that the row with rank 3 has the id attribute
      const highlightedRow = document.getElementById('rank-3');
      expect(highlightedRow).toBeInTheDocument();
    });

    it('should not highlight when highlightedRank is null', () => {
      render(<LeaderboardTable entries={mockEntries} highlightedRank={null} />);

      // All rows should still be rendered, just not highlighted
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('points display', () => {
    it('should show points with "pts" suffix', () => {
      render(<LeaderboardTable entries={mockEntries} />);

      // Multiple "pts" labels should be present
      const ptsLabels = screen.getAllByText('pts');
      expect(ptsLabels).toHaveLength(mockEntries.length);
    });
  });

  describe('className prop', () => {
    it('should apply custom className to table', () => {
      render(<LeaderboardTable entries={mockEntries} className="custom-class" />);

      const table = screen.getByRole('table');
      expect(table).toHaveClass('custom-class');
    });
  });
});
