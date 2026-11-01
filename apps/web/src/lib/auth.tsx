import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@sabjiilelo/shared';
import { api, onAuthChange, tokenStore } from './api';

interface AuthState {
  status: 'loading' | 'in' | 'out';
  user: AuthUser | null;
  loginWithOtp: (phone: string, code: string) => Promise<AuthUser>;
  adminLogin: (username: string, password: string) => Promise<AuthUser>;
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
    // Restore the session from the httpOnly refresh cookie.
    api.http.refresh().then((ok) => {
      if (!ok) setStatus('out');
    });
    return () => {
      off();
    };
  }, []);

  const loginWithOtp = useCallback(async (phone: string, code: string) => {
    const auth = await api.auth.verifyOtp(phone, code);
    await tokenStore.save(auth);
    return auth.user;
  }, []);

  const adminLogin = useCallback(async (username: string, password: string) => {
    const auth = await api.auth.adminLogin(username, password);
    await tokenStore.save(auth);
    return auth.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      await tokenStore.clear();
      qc.clear();
    }
  }, [qc]);

  const value = useMemo(
    () => ({ status, user, loginWithOtp, adminLogin, logout, setUser }),
    [status, user, loginWithOtp, adminLogin, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** Where each role lands after signing in. */
export function homeFor(role: AuthUser['role']): string {
  switch (role) {
    case 'CUSTOMER':
      return '/';
    case 'SUPERADMIN':
      return '/admin/overview';
    case 'DELIVERY':
      return '/dashboard/deliveries';
    case 'VENDOR':
      return '/dashboard/vendor/orders';
    case 'ACCOUNTANT':
      return '/dashboard/accounts/cod';
    case 'HR':
      return '/dashboard/hr';
    default:
      return '/dashboard';
  }
}
