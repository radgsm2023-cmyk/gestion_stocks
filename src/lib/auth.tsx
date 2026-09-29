import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setCurrencySettings } from '@/lib/utils';
import type { Profile, AppSettings } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  settings: AppSettings | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile(data as Profile | null);
  }

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    let s = data as AppSettings | null;
    if (!s) {
      const { data: created } = await supabase
        .from('app_settings')
        .insert({
          id: 1,
          app_title: 'StockFlow',
          currency_symbol: '€',
          currency_code: 'EUR',
          company_name: '',
          company_address: '',
          company_phone: '',
          company_email: '',
          rc: '',
          nif: '',
          ai: '',
        })
        .select()
        .maybeSingle();
      s = created as AppSettings | null;
    }
    setSettings(s);
    if (s) setCurrencySettings(s.currency_symbol, s.currency_code);
  }

  async function refreshProfile() {
    if (session?.user?.id) await loadProfile(session.user.id);
  }

  async function refreshSettings() {
    await loadSettings();
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) {
        Promise.all([loadProfile(s.user.id), loadSettings()]).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      (async () => {
        if (s?.user?.id) {
          await Promise.all([loadProfile(s.user.id), loadSettings()]);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await loadProfile(data.user.id);
      await loadSettings();
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, settings, loading, signIn, signUp, signOut, refreshProfile, refreshSettings }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
