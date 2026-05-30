/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Header } from '../Header';

// AuthMenu pulls in auth + rewards; stub them to a signed-out state so the
// header renders without a provider tree. (jsdom doesn't apply the @container
// reveal classes, so every priority+ copy is present in the DOM — queries that
// could match duplicates use getAllByRole / scoped `within`.)
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, profile: null, signOut: jest.fn() }),
}));
jest.mock('@/hooks/useRewardsStatus', () => ({
  useRewardsStatus: () => ({ status: { totalAvailable: 0 } }),
}));
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn(), resolvedTheme: 'light' }),
}));

const ALL_DESTINATIONS: Array<[string, string]> = [
  ['Home', '/'],
  ['Predictions', '/predictions'],
  ['Leaderboard', '/leaderboard'],
  ['Results', '/results'],
  ['Rules & Scoring', '/rules'],
  ['About', '/about'],
  ['Charities', '/charities'],
  ['Audit', '/audit'],
];

/** True if any rendered link with this accessible name points at `href`. */
function hasLinkTo(name: string, href: string): boolean {
  return screen
    .getAllByRole('link', { name })
    .some((el) => el.getAttribute('href') === href);
}

describe('Header', () => {
  it('renders the always-inline primary links plus a More overflow trigger', () => {
    render(<Header />);

    expect(hasLinkTo('Home', '/')).toBe(true);
    expect(hasLinkTo('Predictions', '/predictions')).toBe(true);
    expect(hasLinkTo('Leaderboard', '/leaderboard')).toBe(true);

    expect(screen.getByRole('button', { name: /more navigation/i })).toBeInTheDocument();
  });

  it('exposes the secondary destinations through the More menu', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: /more navigation/i }));

    // The Radix popover portals its content open; the secondary links live there
    // (Results/Rules also keep their inline copies, hence the document-wide check).
    for (const [name, href] of [
      ['Results', '/results'],
      ['Rules & Scoring', '/rules'],
      ['About', '/about'],
      ['Charities', '/charities'],
      ['Audit', '/audit'],
    ] as Array<[string, string]>) {
      expect(hasLinkTo(name, href)).toBe(true);
    }
  });

  it('lists every destination in the mobile drawer', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    const drawer = screen.getByRole('dialog');
    for (const [name, href] of ALL_DESTINATIONS) {
      const link = within(drawer).getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
    }
  });
});
