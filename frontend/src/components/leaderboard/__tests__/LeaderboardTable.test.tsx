import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { LeaderboardTable } from '../LeaderboardTable';
import type { LeaderboardEntry } from '@/types/tournament';

// Enabling preview mounts BracketPreviewDialog, which calls useQuery.
function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

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

  const fivePlaces: LeaderboardEntry[] = [
    ...entries,
    { ...entries[0], rank: 4, predictionId: 'p4', predictionName: 'Fourth', username: 'dave' },
    { ...entries[0], rank: 5, predictionId: 'p5', predictionName: 'Fifth', username: 'erin' },
  ];

  it('does not flag 4th/5th by default (Phase 1 cutoff of 3)', () => {
    render(<LeaderboardTable entries={fivePlaces} />);
    expect(screen.queryByText('4th')).not.toBeInTheDocument();
    expect(screen.queryByText('5th')).not.toBeInTheDocument();
    // The rank still renders as plain text.
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('flags 4th and 5th when prizeRankCutoff is 5 (Phase 2)', () => {
    render(<LeaderboardTable entries={fivePlaces} prizeRankCutoff={5} />);
    expect(screen.getByText('4th')).toBeInTheDocument();
    expect(screen.getByText('5th')).toBeInTheDocument();
  });

  it('shows the bracket champion flag (pick to win) when present, hidden otherwise', () => {
    render(
      <LeaderboardTable
        entries={[
          { ...entries[0], bracketChampionCode: 'ARG', bracketChampionName: 'Argentina' },
          { ...entries[1], bracketChampionCode: null, bracketChampionName: null },
        ]}
      />
    );
    // The flag wrapper exposes the team name via title + aria-label for hover/SR.
    expect(screen.getByTitle('Argentina')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Pick to win: Argentina')
    ).toBeInTheDocument();
    // The row without a pick renders no flag.
    expect(screen.queryByTitle('Brazil')).not.toBeInTheDocument();
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

  it('renders an Edit link only on the current user row when enableEdit is set', () => {
    render(
      <LeaderboardTable entries={entries} currentUsername="bob" enableEdit />
    );
    const editLinks = screen.getAllByRole('link', { name: /^Edit / });
    expect(editLinks).toHaveLength(1);
    // bob owns the p2 prediction → deep-links to its editor.
    expect(editLinks[0]).toHaveAttribute('href', '/predictions/p2');
  });

  it('omits Edit links when enableEdit is not set', () => {
    render(<LeaderboardTable entries={entries} currentUsername="bob" />);
    expect(screen.queryByRole('link', { name: /^Edit / })).not.toBeInTheDocument();
  });

  it('enables Preview only on the own row and disables others when canPreviewOthers is false', () => {
    render(
      wrap(
        <LeaderboardTable
          entries={entries}
          currentUsername="bob"
          enablePreview
          canPreviewOthers={false}
        />
      )
    );
    // bob owns p2 (Bracket A) → his Preview is clickable.
    const ownPreview = screen.getByRole('button', { name: "Preview Bracket A's bracket" });
    expect(ownPreview).toBeEnabled();
    // Other players' Preview buttons are still rendered but disabled.
    const lockedPreviews = screen.getAllByRole('button', {
      name: /unlocks once the group stage locks$/,
    });
    expect(lockedPreviews).toHaveLength(2);
    lockedPreviews.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('enables every Preview button when canPreviewOthers is true', () => {
    render(
      wrap(
        <LeaderboardTable
          entries={entries}
          currentUsername="bob"
          enablePreview
          canPreviewOthers
        />
      )
    );
    const previews = screen.getAllByRole('button', { name: /'s bracket$/ });
    expect(previews).toHaveLength(3);
    previews.forEach((btn) => expect(btn).toBeEnabled());
    expect(
      screen.queryByRole('button', { name: /unlocks once the group stage locks$/ })
    ).not.toBeInTheDocument();
  });
});
