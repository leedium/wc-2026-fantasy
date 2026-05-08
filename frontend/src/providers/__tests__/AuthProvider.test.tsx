import { act, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { AuthProvider, useAuthContext } from '../AuthProvider';

type AuthChangeCallback = (event: string, session: { user: User } | null) => void;

let authCallback: AuthChangeCallback | null = null;
const fromMock = jest.fn();
const signOutMock = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      onAuthStateChange: (cb: AuthChangeCallback) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
      signOut: signOutMock,
    },
    from: fromMock,
  }),
}));

function Consumer() {
  const { user, profile, loading } = useAuthContext();
  return (
    <div>
      <span data-testid="user">{user?.id ?? 'none'}</span>
      <span data-testid="username">{profile?.username ?? 'none'}</span>
      <span data-testid="loading">{loading ? 'loading' : 'idle'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    authCallback = null;
    fromMock.mockReset();
  });

  it('exposes initial user and profile', () => {
    render(
      <AuthProvider
        initialUser={{ id: 'u1' } as User}
        initialProfile={{
          id: 'u1',
          username: 'alice',
          displayName: null,
          avatarUrl: null,
          isAdmin: false,
          isSuperAdmin: false,
        }}
      >
        <Consumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('user').textContent).toBe('u1');
    expect(screen.getByTestId('username').textContent).toBe('alice');
  });

  it('uses default (null user) when no provider wraps consumer', () => {
    render(<Consumer />);
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('username').textContent).toBe('none');
  });

  it('reacts to onAuthStateChange and refetches profile', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'u2',
              username: 'bob',
              display_name: null,
              avatar_url: null,
              is_admin: false,
            },
          }),
        }),
      }),
    }));

    render(
      <AuthProvider initialUser={null} initialProfile={null}>
        <Consumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('user').textContent).toBe('none');

    await act(async () => {
      authCallback?.('SIGNED_IN', { user: { id: 'u2' } as User });
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('u2');
      expect(screen.getByTestId('username').textContent).toBe('bob');
    });
  });
});
