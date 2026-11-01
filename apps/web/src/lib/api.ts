import { createApi, type TokenStore } from '@sabjiilelo/api-client';
import type { AuthResponse } from '@sabjiilelo/shared';

/**
 * Web keeps the access token in memory only. The refresh token sits in an httpOnly
 * cookie set by the API, so a page reload restores the session with /auth/refresh.
 */
let accessToken: string | null = null;
const listeners = new Set<(auth: AuthResponse | null) => void>();

export const tokenStore: TokenStore = {
  getAccess: () => accessToken,
  getRefresh: async () => null,
  async save(auth) {
    accessToken = auth.accessToken;
    listeners.forEach((l) => l(auth));
  },
  async clear() {
    accessToken = null;
    listeners.forEach((l) => l(null));
  },
};

export function onAuthChange(fn: (auth: AuthResponse | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const api = createApi({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',
  client: 'web',
  store: tokenStore,
});

/** Opens a PDF or CSV endpoint that needs the bearer token. */
export async function openBlob(promise: Promise<Blob>, filename?: string) {
  const blob = await promise;
  const url = URL.createObjectURL(blob);
  // Pop-up blockers may refuse a tab opened after an await; fall back to a download.
  const opened = !filename && window.open(url, '_blank');
  if (!opened) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? 'document';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
