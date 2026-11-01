import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@sabjiilelo/shared';
import { api, onAuthChange, tokenStore } from './api';
import { registerForPush } from './push';

interface AuthState {
  status: 'loading' | 'in' | 'out';
  user: AuthUser | null;
  login: (phone: string, code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (u: AuthUser) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  useEffect(() => {
    const off = onAuthChange((auth) => {
      setUser(auth?.user ?? null);
      setStatus(auth ? 'in' : 'out');
    });
    api.http.refresh().then((ok) => !ok && setStatus('out'));
    return off;
  }, []);

  // Register the device for order / delivery notifications once signed in.
  useEffect(() => {
    if (!user) return;
    registerForPush().then((token) => {
      if (token) api.auth.pushToken(token).catch(() => undefined);
    });
  }, [user?.id]);

  const login = useCallback(async (phone: string, code: string) => {
    const auth = await api.auth.verifyOtp(phone, code);
    await tokenStore.save(auth);
    return auth.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.pushToken(null).catch(() => undefined);
      await api.auth.logout(await tokenStore.getRefresh());
    } finally {
      await tokenStore.clear();
      qc.clear();
    }
  }, [qc]);

  const value = useMemo(() => ({ status, user, login, logout, setUser }), [status, user, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
