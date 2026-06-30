/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { AdminUserBracket } from '../AdminUserBracket';

const mockProfile = { isSuperAdmin: false };
const mockLock = { isLocked: false, isLoading: false, isPhase1Open: true };

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin1' }, profile: mockProfile }),
}));
jest.mock('@/hooks/useTournamentLock', () => ({
  useTournamentLock: () => mockLock,
}));
jest.mock('@/components/predictions/BracketPreviewDialog', () => ({
  BracketPreviewDialog: () => null,
}));

const invalidate = jest.fn().mockResolvedValue(undefined);
const predictionsData = {
  tournament: { id: 't1', lockTime: new Date(Date.now() - 1000).toISOString() },
  user: { id: 'u1', username: 'bob', displayName: 'Bob', email: 'b@e.com' },
  predictions: [
    {
      id: 'pred-1',
      name: 'Main',
      totalGoals: 7,
      submittedAt: new Date().toISOString(),
      isPaid: true,
      paidAt: new Date().toISOString(),
      markedBy: 'admin1',
      isFreePaid: false,
      voided: false,
    },
  ],
};

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: predictionsData, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: invalidate }),
}));

afterEach(() => {
  mockProfile.isSuperAdmin = false;
  mockLock.isLocked = false;
  mockLock.isLoading = false;
  jest.restoreAllMocks();
});

describe('AdminUserBracket — lock-time edit hiding + void', () => {
  it('non-super admin + locked: hides Edit + New prediction, keeps Void', () => {
    mockProfile.isSuperAdmin = false;
    mockLock.isLocked = true;
    render(<AdminUserBracket userId="u1" />);

    expect(screen.queryByRole('link', { name: /New prediction/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Edit$/i })).toBeNull();
    // Void affordance stays available to any admin.
    expect(screen.getByRole('button', { name: /^Void$/i })).toBeInTheDocument();
  });

  it('super admin + locked: ALSO hides Edit + New prediction', () => {
    mockProfile.isSuperAdmin = true;
    mockLock.isLocked = true;
    render(<AdminUserBracket userId="u1" />);

    // The admin editor is read-only for everyone once locked — super admins
    // included. Void stays available.
    expect(screen.queryByRole('link', { name: /New prediction/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Edit$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^Void$/i })).toBeInTheDocument();
  });

  it('unlocked: shows Edit + New prediction', () => {
    mockProfile.isSuperAdmin = false;
    mockLock.isLocked = false;
    render(<AdminUserBracket userId="u1" />);

    expect(screen.getByRole('link', { name: /New prediction/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Edit$/i })).toBeInTheDocument();
  });

  it('Void button PATCHes the void endpoint', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ voided: true }) });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    const user = userEvent.setup();
    render(<AdminUserBracket userId="u1" />);

    await user.click(screen.getByRole('button', { name: /^Void$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/predictions/pred-1/void',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ void: true }),
        })
      )
    );
  });
});
