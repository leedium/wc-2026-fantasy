'use client';

import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { clearAllDrafts } from '@/hooks/useDraftPersistence';
import type { Profile } from '@/types/tournament';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser: User | null;
  initialProfile: Profile | null;
}

export function AuthProvider({ children, initialUser, initialProfile }: AuthProviderProps) {
  const [user, setUser] = React.useState<User | null>(initialUser);
  const [profile, setProfile] = React.useState<Profile | null>(initialProfile);
  const [loading, setLoading] = React.useState(false);

  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();

  // Whose profile (if any) SSR resolved at mount. Drives whether the
  // INITIAL_SESSION handler below still needs to fetch the profile client-side.
  // A ref (not a dep) so the auth listener effect stays mounted-once.
  const initialProfileUserIdRef = React.useRef(initialProfile?.id ?? null);

  const loadProfile = React.useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_admin, is_super_admin')
        .eq('id', userId)
        .maybeSingle();
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile({
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        isAdmin: data.is_admin,
        isSuperAdmin: data.is_super_admin,
      });
    },
    [supabase]
  );

  React.useEffect(() => {
    // Never await Supabase calls inside this callback — auth-js holds an internal
    // navigator.locks lock for the duration of the listener, and re-entering it
    // can wedge a later signOut() (see supabase/auth-js#762). queryClient.clear()
    // and clearAllDrafts() are sync, so they're safe to call here.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_OUT fires for both same-tab signOut() and cross-tab logouts;
      // wiping the React Query cache here is what prevents user A's
      // /predictions data from being served to user B if they sign in
      // within the gcTime window (5 min by QueryProvider default). Idempotent
      // with the explicit clear in signOut() below.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        return;
      }
      // On the initial client session we normally trust the SSR-provided
      // initialProfile and skip a redundant fetch. But if SSR couldn't resolve
      // the session (server/client cookie skew — e.g. right after a local DB
      // reset), initialProfile is null while the client DOES hold a session.
      // Without this, profile stays null and profile-gated UI (the Admin link,
      // rewards badge, etc.) silently stays hidden until some later auth event
      // fires. Fetch when SSR gave us no profile, or one for a different user.
      if (event === 'INITIAL_SESSION') {
        if (initialProfileUserIdRef.current !== session.user.id) {
          void loadProfile(session.user.id);
        }
        return;
      }
      void loadProfile(session.user.id);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase, loadProfile, queryClient]);

  const signOut = React.useCallback(async () => {
    setLoading(true);
    const userId = user?.id;
    await supabase.auth.signOut({ scope: 'local' });
    if (userId) clearAllDrafts(userId);
    // Wipe the React Query cache so the next sign-in (possibly as a
    // different user) doesn't see this user's predictions / referral
    // status / etc. served from the still-warm gcTime cache. The
    // SIGNED_OUT listener above does this too — keeping it here as well
    // makes the cleanup happen even if the listener doesn't fire (e.g.
    // the auth-js lock wedges and AuthMenu's 5s fallback fires first).
    queryClient.clear();
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, [supabase, user, queryClient]);

  const refreshProfile = React.useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const defaultAuthValue: AuthContextValue = {
  user: null,
  profile: null,
  loading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
};

export function useAuthContext() {
  return React.useContext(AuthContext) ?? defaultAuthValue;
}
