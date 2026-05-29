import { render, screen } from '@testing-library/react';
import { LeaderboardTable } from '../LeaderboardTable';
import type { LeaderboardEntry } from '@/types/tournament';

const entries: LeaderboardEntry[] = [
  {
    rank: 1,
    predictionId: 'p1',
    predictionName: 'Main',
    username: 'alice',
    points: 200,
    change: 2,
    groupPoints: 90,
    advancerPoints: 0,
    knockoutPoints: 110,
    championPickPoints: 0,
  },
  {
    rank: 2,
    predictionId: 'p2',
    predictionName: 'Bracket A',
    username: 'bob',
    points: 180,
    change: 0,
    groupPoints: 80,
    advancerPoints: 0,
    knockoutPoints: 100,
    championPickPoints: 0,
  },
  {
    rank: 3,
    predictionId: 'p3',
    predictionName: 'Hedge',
    username: 'carol',
    points: 170,
    change: -1,
    groupPoints: 75,
    advancerPoints: 0,
    knockoutPoints: 95,
    championPickPoints: 0,
  },
];

describe('LeaderboardTable', () => {
  it('renders prediction names and usernames', () => {
    render(<LeaderboardTable entries={entries} />);
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Bracket A')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('marks the current user row', () => {
    render(<LeaderboardTable entries={entries} currentUsername="bob" />);
    expect(screen.getByText('(You)')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<LeaderboardTable entries={[]} />);
    expect(screen.getByText('No entries found.')).toBeInTheDocument();
  });

  it('shows trophy badges for top 3', () => {
    render(<LeaderboardTable entries={entries} />);
    expect(screen.getByText('1st')).toBeInTheDocument();
    expect(screen.getByText('2nd')).toBeInTheDocument();
    expect(screen.getByText('3rd')).toBeInTheDocument();
  });

  it('renders email in place of username when present (admin view)', () => {
    const adminEntries: LeaderboardEntry[] = [
      { ...entries[0], email: 'alice@example.com' },
    ];
    render(<LeaderboardTable entries={adminEntries} />);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.queryByText('alice')).not.toBeInTheDocument();
  });

  it('shows a "last updated" time when present, and omits it otherwise', () => {
    render(
      <LeaderboardTable
        entries={[{ ...entries[0], updatedAt: '2026-05-29T12:00:00.000Z' }]}
      />
    );
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
  });

  it('omits the updated line when updatedAt is absent', () => {
    render(<LeaderboardTable entries={entries} />);
    expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
  });
});
