import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { apiMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'error' | 'noProfile' | 'ready';

interface AuthValue {
  status: AuthStatus;
  profile: Profile | null;
  retry: () => void;
  signInWithEmail: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, manager_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(apiMessage(error.message));
  return data as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // undefined = still reading the stored session
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
    retry: 1,
  });

  const signInWithEmail = useCallback(async (email: string): Promise<string | null> => {
    if (!supabase) return 'The app is not connected to Supabase.';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return error ? apiMessage(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const retry = useCallback(() => {
    void profileQuery.refetch();
  }, [profileQuery]);

  const value = useMemo<AuthValue>(() => {
    let status: AuthStatus;
    if (!supabase) status = 'unconfigured';
    else if (session === undefined) status = 'loading';
    else if (session === null) status = 'signedOut';
    else if (profileQuery.isError) status = 'error';
    else if (profileQuery.isPending) status = 'loading';
    else if (!profileQuery.data) status = 'noProfile';
    else status = 'ready';
    return { status, profile: profileQuery.data ?? null, retry, signInWithEmail, signOut };
  }, [session, profileQuery.isError, profileQuery.isPending, profileQuery.data, retry, signInWithEmail, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
