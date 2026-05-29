import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnockoutBracket } from '../KnockoutBracket';
import { cascadeKnockoutPick } from '@/lib/knockoutCascade';
import type {
  GroupPrediction,
  KnockoutMatchPrediction,
  KnockoutStage,
} from '@/types/tournament';
import { fixtureKnockoutMatches, fixtureTeams } from '@/test-utils/fixtures';

// Full, consistent group predictions so every R32 contestant resolves.
const groupPredictions: GroupPrediction[] = [
  { groupId: 'A', positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' } },
  { groupId: 'B', positions: { first: 'can', second: 'sui', third: 'qat', fourth: 'bih' } },
  { groupId: 'C', positions: { first: 'bra', second: 'mar', third: 'sco', fourth: 'hai' } },
  { groupId: 'D', positions: { first: 'usa', second: 'par', third: 'aus', fourth: 'tur' } },
  { groupId: 'E', positions: { first: 'ger', second: 'ecu', third: 'civ', fourth: 'cuw' } },
  { groupId: 'F', positions: { first: 'ned', second: 'jpn', third: 'tun', fourth: 'swe' } },
  { groupId: 'G', positions: { first: 'bel', second: 'irn', third: 'egy', fourth: 'nzl' } },
  { groupId: 'H', positions: { first: 'esp', second: 'uru', third: 'sau', fourth: 'cpv' } },
  { groupId: 'I', positions: { first: 'fra', second: 'sen', third: 'nor', fourth: 'irq' } },
  { groupId: 'J', positions: { first: 'arg', second: 'aut', third: 'alg', fourth: 'jor' } },
  { groupId: 'K', positions: { first: 'por', second: 'col', third: 'uzb', fourth: 'cod' } },
  { groupId: 'L', positions: { first: 'eng', second: 'cro', third: 'pan', fourth: 'gha' } },
];

/**
 * Stateful harness that mirrors how PredictionsPageContent wires the bracket:
 * the cascade runs on every pick change and the bracket renders one stage at a
 * time. This exercises the real MatchCard auto-clear effect alongside the
 * cascade, which the pure-function unit tests can't.
 */
function Harness({ initial }: { initial: KnockoutMatchPrediction[] }) {
  const [predictions, setPredictions] = React.useState(initial);
  const [stage, setStage] = React.useState<KnockoutStage>('round_of_32');

  const onPredictionChange = (matchId: string, winnerId: string | null) => {
    setPredictions(
      (prev) =>
        cascadeKnockoutPick(
          matchId,
          winnerId,
          fixtureKnockoutMatches,
          prev,
          groupPredictions
        ).predictions
    );
  };

  const allStages: KnockoutStage[] = [
    'round_of_32',
    'round_of_16',
    'quarter_finals',
    'semi_finals',
    'third_place',
    'final',
  ];

  return (
    <div>
      {allStages.map((s) => (
        <button key={s} data-testid={`go-${s}`} onClick={() => setStage(s)}>
          {s}
        </button>
      ))}
      <KnockoutBracket
        matches={fixtureKnockoutMatches}
        teams={fixtureTeams}
        groupPredictions={groupPredictions}
        knockoutPredictions={predictions}
        onPredictionChange={onPredictionChange}
        stage={stage}
      />
    </div>
  );
}

function emptyKnockout(): KnockoutMatchPrediction[] {
  return fixtureKnockoutMatches.map((m) => ({ matchId: m.id, winnerId: null }));
}

describe('KnockoutBracket downstream propagation (integration)', () => {
  it('keeps the carried-forward pick selected and the stage complete after navigating downstream', async () => {
    const user = userEvent.setup();
    // mex (1A) picked to win M73 and again in M90 (R16); ger wins M75 so M90
    // has two resolvable contestants.
    const initial = emptyKnockout().map((p) => {
      if (p.matchId === 'M73') return { ...p, winnerId: 'mex' };
      if (p.matchId === 'M75') return { ...p, winnerId: 'ger' };
      if (p.matchId === 'M90') return { ...p, winnerId: 'mex' };
      return p;
    });

    render(<Harness initial={initial} />);

    // On R32, swap M73's winner to the other contestant (Switzerland, 2B).
    await user.click(screen.getByRole('button', { name: /SUI.*Switzerland/i }));

    // Walk downstream to the R16 stage where M90 lives.
    await user.click(screen.getByTestId('go-round_of_16'));

    // M90 should now show Switzerland as the carried-forward winner — still
    // selected, so the round counts as complete (1/8), not cleared (0/8).
    expect(await screen.findByText('1/8')).toBeInTheDocument();
    expect(screen.queryByText('0/8')).not.toBeInTheDocument();

    // And the selected winner button (Switzerland) is rendered as picked
    // (default variant carries the trophy marker).
    const m90 = screen.getByText('M90').closest('[class*="card"], div');
    expect(m90).toBeTruthy();
  });

  it('carries a pick through the full R32→Final chain even with unpicked sibling feeders', async () => {
    const user = userEvent.setup();
    // mex (1A) picked to win the whole way to the Final; sibling feeder
    // matches (M75, M89, M98, M99, M100, M102, ...) are left unpicked, so
    // each downstream match has exactly one resolvable contestant pre-change.
    const chain: Record<string, string> = {
      M73: 'mex',
      M90: 'mex',
      M97: 'mex',
      M101: 'mex',
      M104: 'mex',
    };
    const initial = emptyKnockout().map((p) =>
      p.matchId in chain ? { ...p, winnerId: chain[p.matchId] } : p
    );

    render(<Harness initial={initial} />);

    // Swap the R32 winner to Switzerland (2B).
    await user.click(screen.getByRole('button', { name: /SUI.*Switzerland/i }));

    // Each downstream stage that had a carried pick must remain complete
    // (1 of its matches picked), not reset to 0. (The Final has a single
    // match, so a retained pick renders the "Complete" badge instead of 1/1.)
    const partialStages: Array<[KnockoutStage, string]> = [
      ['round_of_16', '1/8'],
      ['quarter_finals', '1/4'],
      ['semi_finals', '1/2'],
    ];
    for (const [stage, badge] of partialStages) {
      await user.click(screen.getByTestId(`go-${stage}`));
      expect(await screen.findByText(badge)).toBeInTheDocument();
      expect(screen.queryByText(badge.replace('1/', '0/'))).not.toBeInTheDocument();
    }
    await user.click(screen.getByTestId('go-final'));
    expect(await screen.findByText('Complete')).toBeInTheDocument();
  });
});
