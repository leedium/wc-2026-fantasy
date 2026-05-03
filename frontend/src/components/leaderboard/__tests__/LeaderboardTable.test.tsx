import { render, screen } from '@testing-library/react';
import { LeaderboardTable } from '../LeaderboardTable';
import type { LeaderboardEntry } from '@/types/tournament';

const entries: LeaderboardEntry[] = [
  { rank: 1, username: 'alice', points: 200, change: 2, groupPoints: 90, knockoutPoints: 110 },
  { rank: 2, username: 'bob', points: 180, change: 0, groupPoints: 80, knockoutPoints: 100 },
  { rank: 3, username: 'carol', points: 170, change: -1, groupPoints: 75, knockoutPoints: 95 },
];

describe('LeaderboardTable', () => {
  it('renders usernames', () => {
    render(<LeaderboardTable entries={entries} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
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
});
