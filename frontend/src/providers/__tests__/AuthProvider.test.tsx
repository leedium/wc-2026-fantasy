import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// AuthProvider depends on useQueryClient() to wipe the cache on sign-out.
// Use a fresh client per test so cache state can't leak across cases.
let queryClient: QueryClient;

function withProviders(ui: React.ReactNode) {
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

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
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  it('exposes initial user and profile', () => {
    render(
      withProviders(
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
      )
    );

    expect(screen.getByTestId('user').textContent).toBe('u1');
    expect(screen.getByTestId('username').textContent).toBe('alice');
  });

  it('uses default (null user) when no provider wraps consumer', () => {
    // No QueryClientProvider needed — useAuthContext falls back to the
    // default value when AuthProvider isn't in the tree.
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
      withProviders(
        <AuthProvider initialUser={null} initialProfile={null}>
          <Consumer />
        </AuthProvider>
      )
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

  it('clears the React Query cache when SIGNED_OUT fires', async () => {
    // Seed cache with stale data that would belong to the previous user.
    queryClient.setQueryData(['predictions'], { stale: true });
    queryClient.setQueryData(['rewardsStatus'], { totalAvailable: 0 });
    expect(queryClient.getQueryData(['predictions'])).toEqual({ stale: true });

    render(
      withProviders(
        <AuthProvider
          initialUser={{ id: 'u1' } as User}
          initialProfile={null}
        >
          <Consumer />
        </AuthProvider>
      )
    );

    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
    });

    expect(queryClient.getQueryData(['predictions'])).toBeUndefined();
    expect(queryClient.getQueryData(['rewardsStatus'])).toBeUndefined();
  });
});
