import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getEmailRedirectUrl = () => {
  const configuredRedirect = import.meta.env.VITE_AUTH_EMAIL_REDIRECT_URL as string | undefined;
  if (configuredRedirect && configuredRedirect.trim()) {
    return configuredRedirect.trim();
  }

  // Forwarded preview hosts are often not whitelisted in Supabase auth settings.
  // Fall back to no redirect in that case so signup does not fail with 422.
  const { hostname, origin } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocalHost ? `${origin}/` : undefined;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const emailRedirectTo = getEmailRedirectUrl();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: { username: username.trim() },
        },
      });
      return { error: error as Error | null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'Signup failed') };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error as Error | null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'Sign in failed') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
