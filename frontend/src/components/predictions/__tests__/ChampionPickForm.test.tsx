import { render, screen } from '@testing-library/react';
import { ChampionPickForm } from '../ChampionPickForm';
import type { Team } from '@/types/tournament';

const sampleTeams: Team[] = [
  { id: 'arg', name: 'Argentina', code: 'ARG', group: 'A' },
  { id: 'bra', name: 'Brazil', code: 'BRA', group: 'B' },
  { id: 'fra', name: 'France', code: 'FRA', group: 'A' },
  { id: 'ger', name: 'Germany', code: 'GER', group: 'C' },
];

describe('ChampionPickForm', () => {
  it('renders the section heading and trigger', () => {
    render(
      <ChampionPickForm teams={sampleTeams} value={null} onChange={jest.fn()} />
    );
    expect(screen.getByText('Phase 1 Champions Pick')).toBeInTheDocument();
    expect(screen.getByTestId('champion-pick-select')).toBeInTheDocument();
  });

  it('shows "Not picked" badge when value is null', () => {
    render(
      <ChampionPickForm teams={sampleTeams} value={null} onChange={jest.fn()} />
    );
    expect(screen.getByText('Not picked')).toBeInTheDocument();
  });

  it('shows "Set" badge and the picked team summary when value is set', () => {
    render(
      <ChampionPickForm teams={sampleTeams} value="arg" onChange={jest.fn()} />
    );
    expect(screen.getByText('Set')).toBeInTheDocument();
    expect(screen.getByText(/Your champion:/i)).toBeInTheDocument();
    // Argentina renders in both the Select trigger value and the summary line,
    // so assert by count rather than uniqueness.
    expect(screen.getAllByText('Argentina').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/from Group A/)).toBeInTheDocument();
  });

  it('disables the Select when disabled prop is true', () => {
    render(
      <ChampionPickForm
        teams={sampleTeams}
        value={null}
        onChange={jest.fn()}
        disabled
      />
    );
    expect(screen.getByTestId('champion-pick-select')).toBeDisabled();
  });
});
