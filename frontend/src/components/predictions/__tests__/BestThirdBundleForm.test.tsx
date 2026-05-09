/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { BestThirdBundleForm } from '../BestThirdBundleForm';
import { fixtureTeams } from '@/test-utils/fixtures';
import { BUNDLE_SLOTS } from '@/lib/constants';

describe('BestThirdBundleForm', () => {
  it('renders one card per FIFA bundle slot', () => {
    render(
      <BestThirdBundleForm
        teams={fixtureTeams}
        groupPredictions={[]}
        bundlePredictions={[]}
        onBundleChange={jest.fn()}
      />
    );

    BUNDLE_SLOTS.forEach((slot) => {
      const card = screen.getByTestId(`bundle-slot-${slot.slotIndex}`);
      const scope = within(card);
      expect(
        scope.getByText(`Best 3rd of ${slot.allowedLetters.join('/')}`)
      ).toBeInTheDocument();
      expect(scope.getByText(`Feeds R32 match ${slot.r32MatchId}`)).toBeInTheDocument();
    });
  });

  it('reports completion progress', () => {
    render(
      <BestThirdBundleForm
        teams={fixtureTeams}
        groupPredictions={[]}
        bundlePredictions={[
          { slotIndex: 0, groupLetter: 'A' },
          { slotIndex: 1, groupLetter: 'C' },
        ]}
        onBundleChange={jest.fn()}
      />
    );

    expect(screen.getByText('2 / 8 bundles complete')).toBeInTheDocument();
  });

  it('previews the user-predicted 3rd-place team alongside each pick', () => {
    render(
      <BestThirdBundleForm
        teams={fixtureTeams}
        groupPredictions={[
          {
            groupId: 'A',
            positions: { first: 'mex', second: 'kor', third: 'rsa', fourth: 'cze' },
          },
        ]}
        bundlePredictions={[{ slotIndex: 0, groupLetter: 'A' }]}
        onBundleChange={jest.fn()}
      />
    );

    expect(screen.getByText(/South Africa/)).toBeInTheDocument();
  });
});
