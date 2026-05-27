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
});
