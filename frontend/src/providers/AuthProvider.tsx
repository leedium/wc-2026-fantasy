'use client';

import * as React from 'react';
import type { User } from '@supabase/supabase-js';
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

  const loadProfile = React.useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_admin')
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
      });
    },
    [supabase]
  );

  React.useEffect(() => {
    // Never await Supabase calls inside this callback — auth-js holds an internal
    // navigator.locks lock for the duration of the listener, and re-entering it
    // can wedge a later signOut() (see supabase/auth-js#762).
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        return;
      }
      if (event === 'INITIAL_SESSION') return;
      void loadProfile(session.user.id);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const signOut = React.useCallback(async () => {
    setLoading(true);
    const userId = user?.id;
    await supabase.auth.signOut({ scope: 'local' });
    if (userId) clearAllDrafts(userId);
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, [supabase, user]);

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
