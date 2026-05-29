import { render, screen } from '@testing-library/react';

import { GroupStandingsResults } from '../GroupStandingsResults';
import { AdvancersResults } from '../AdvancersResults';
import { fixtureGroups, fixtureTeams } from '@/test-utils/fixtures';
import type { GroupStanding, TournamentAdvancer } from '@/types/tournament';

describe('GroupStandingsResults', () => {
  it('renders all 12 group cards as pending when no standings are posted', () => {
    render(
      <GroupStandingsResults groups={fixtureGroups} teams={fixtureTeams} standings={[]} />
    );
    // One card per group, all pending.
    expect(screen.getByTestId('group-result-A')).toBeInTheDocument();
    expect(screen.getByTestId('group-result-L')).toBeInTheDocument();
    expect(screen.getAllByText('Pending')).toHaveLength(12);
  });

  it('renders the posted finishers for a group', () => {
    const standings: GroupStanding[] = [
      {
        groupId: 'A',
        firstTeamId: 'mex',
        secondTeamId: 'kor',
        thirdTeamId: 'rsa',
        fourthTeamId: 'cze',
      },
    ];
    render(
      <GroupStandingsResults
        groups={fixtureGroups}
        teams={fixtureTeams}
        standings={standings}
      />
    );
    const card = screen.getByTestId('group-result-A');
    expect(card).toHaveTextContent('Final');
    expect(card).toHaveTextContent('Mexico');
    expect(card).toHaveTextContent('South Korea');
    expect(card).toHaveTextContent('South Africa');
    expect(card).toHaveTextContent('Czechia');
  });

  it('hides the status badge when showStatusBadge is false (prediction view)', () => {
    const standings: GroupStanding[] = [
      {
        groupId: 'A',
        firstTeamId: 'mex',
        secondTeamId: 'kor',
        thirdTeamId: 'rsa',
        fourthTeamId: 'cze',
      },
    ];
    render(
      <GroupStandingsResults
        groups={fixtureGroups}
        teams={fixtureTeams}
        standings={standings}
        showStatusBadge={false}
      />
    );
    expect(screen.queryByText('Final')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    // Finishers still render — only the results-only status badge is gone.
    expect(screen.getByTestId('group-result-A')).toHaveTextContent('Mexico');
  });
});

describe('AdvancersResults', () => {
  it('renders 8 ranks all pending when none are posted', () => {
    render(<AdvancersResults advancers={[]} teams={fixtureTeams} />);
    expect(screen.getAllByText('Pending')).toHaveLength(8);
    expect(screen.getByTestId('advancer-result-1')).toBeInTheDocument();
    expect(screen.getByTestId('advancer-result-8')).toBeInTheDocument();
  });

  it('renders posted advancers with team name and group', () => {
    const advancers: TournamentAdvancer[] = [
      { rank: 1, teamId: 'jpn' },
      { rank: 2, teamId: 'mar' },
    ];
    render(<AdvancersResults advancers={advancers} teams={fixtureTeams} />);
    const first = screen.getByTestId('advancer-result-1');
    expect(first).toHaveTextContent('Japan');
    expect(first).toHaveTextContent('Group F');
    const second = screen.getByTestId('advancer-result-2');
    expect(second).toHaveTextContent('Morocco');
    expect(second).toHaveTextContent('Group C');
  });
});
