/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { BracketView } from '../BracketView';
import { fixtureKnockoutMatches, fixtureTeams } from '@/test-utils/fixtures';

describe('BracketView', () => {
  it('renders all 32 match nodes plus the third-place play-off', () => {
    render(
      <BracketView
        matches={fixtureKnockoutMatches}
        teams={fixtureTeams}
        groupPredictions={[]}
        knockoutPredictions={[]}
      />
    );

    // 32 match nodes total (M73..M104, with M103 being third place).
    for (let i = 73; i <= 104; i++) {
      expect(screen.getByTestId(`bracket-match-M${i}`)).toBeInTheDocument();
    }
    expect(screen.getByText(/Third-place play-off/i)).toBeInTheDocument();
  });

  it('renders TBD when picks are missing', () => {
    render(
      <BracketView
        matches={fixtureKnockoutMatches}
        teams={fixtureTeams}
        groupPredictions={[]}
        knockoutPredictions={[]}
      />
    );
    const m1 = screen.getByTestId('bracket-match-M73');
    expect(within(m1).getAllByText('TBD').length).toBeGreaterThan(0);
  });

  it('shows the winning team highlighted with a trophy', () => {
    const groupPredictions = [
      {
        groupId: 'A',
        positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' },
      },
      {
        groupId: 'B',
        positions: { first: 'sui', second: 'qat', third: 'bih', fourth: 'can' },
      },
    ];
    const knockoutPredictions = [{ matchId: 'M73', winnerId: 'mex' }];

    render(
      <BracketView
        matches={fixtureKnockoutMatches}
        teams={fixtureTeams}
        groupPredictions={groupPredictions}
        knockoutPredictions={knockoutPredictions}
      />
    );

    const m1 = screen.getByTestId('bracket-match-M73');
    expect(within(m1).getByText('Mexico')).toBeInTheDocument();
    expect(within(m1).getByText('Qatar')).toBeInTheDocument();
  });

  it('highlights the winner against the user group predictions when no standings are given', () => {
    // M73 = "1A vs 2B": first of A (mex) vs second of B (qat). Winner mex.
    const groupPredictions = [
      { groupId: 'A', positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' } },
      { groupId: 'B', positions: { first: 'sui', second: 'qat', third: 'bih', fourth: 'can' } },
    ];

    render(
      <BracketView
        matches={fixtureKnockoutMatches}
        teams={fixtureTeams}
        groupPredictions={groupPredictions}
        knockoutPredictions={[{ matchId: 'M73', winnerId: 'mex' }]}
      />
    );

    const m73 = screen.getByTestId('bracket-match-M73');
    const winnerRow = within(m73).getByText('Mexico').closest('div');
    expect(winnerRow).toHaveClass('text-primary');
  });

  it('resolves R32 slots from groupStandings when provided, highlighting the stored winner', () => {
    // The bug: in Phase 2 the editor builds the bracket against admin standings,
    // so a stored R32 winner is a standings-derived team. If the preview resolves
    // R32 from the user's *predicted* standings instead, the winner matches no
    // slot and nothing highlights. Passing groupStandings fixes it.
    const groupPredictions = [
      { groupId: 'A', positions: { first: 'mex', second: 'rsa', third: 'cze', fourth: 'kor' } },
      { groupId: 'B', positions: { first: 'can', second: 'qat', third: 'bih', fourth: 'sui' } },
    ];
    // Actual standings differ: A first = kor, B second = sui. M73 = "1A vs 2B".
    const groupStandings = [
      {
        groupId: 'A',
        firstTeamId: 'kor',
        secondTeamId: 'mex',
        thirdTeamId: 'rsa',
        fourthTeamId: 'cze',
      },
      {
        groupId: 'B',
        firstTeamId: 'can',
        secondTeamId: 'sui',
        thirdTeamId: 'qat',
        fourthTeamId: 'bih',
      },
    ];
    const knockoutPredictions = [{ matchId: 'M73', winnerId: 'kor' }];

    render(
      <BracketView
        matches={fixtureKnockoutMatches}
        teams={fixtureTeams}
        groupPredictions={groupPredictions}
        knockoutPredictions={knockoutPredictions}
        groupStandings={groupStandings}
      />
    );

    const m73 = screen.getByTestId('bracket-match-M73');
    // Slots reflect the actual standings, not the user's predicted standings.
    expect(within(m73).getByText('South Korea')).toBeInTheDocument();
    expect(within(m73).getByText('Switzerland')).toBeInTheDocument();
    expect(within(m73).queryByText('Mexico')).not.toBeInTheDocument();
    // The stored winner (kor) now matches a slot and is highlighted.
    const winnerRow = within(m73).getByText('South Korea').closest('div');
    expect(winnerRow).toHaveClass('text-primary');
  });
});
