import type { ApiErrorBody, AuthResponse } from '@sabjiilelo/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Where tokens live differs per platform: memory + httpOnly cookie on web, SecureStore on the phone. */
export interface TokenStore {
  getAccess(): string | null;
  getRefresh(): Promise<string | null>;
  save(auth: AuthResponse): Promise<void>;
  clear(): Promise<void>;
}

export interface HttpConfig {
  baseUrl: string;
  client: 'web' | 'app';
  store: TokenStore;
  /** Called when the refresh token is no longer valid; the app should go to the login screen. */
  onAuthLost?: () => void;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function createHttp(config: HttpConfig) {
  let refreshing: Promise<boolean> | null = null;

  async function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const refreshToken = await config.store.getRefresh();
        if (config.client === 'app' && !refreshToken) return false;
        const res = await fetch(`${config.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        });
        if (!res.ok) return false;
        await config.store.save((await res.json()) as AuthResponse);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
    return refreshing;
  }

  function url(path: string, query?: Query) {
    const qs = query
      ? Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return `${config.baseUrl}${path}${qs ? `?${qs}` : ''}`;
  }

  async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query; form?: FormData; raw?: boolean } = {}, retry = true): Promise<T> {
    const headers: Record<string, string> = {};
    const token = config.store.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(url(path, opts.query), {
        method,
        headers,
        credentials: 'include',
        body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'No internet connection. Please check and try again.');
    }

    if (res.status === 401 && retry && !path.startsWith('/auth/')) {
      if (await refresh()) return request<T>(method, path, opts, false);
      await config.store.clear();
      config.onAuthLost?.();
    }
    if (!res.ok) {
      let body: ApiErrorBody | null = null;
      try {
        body = (await res.json()) as ApiErrorBody;
      } catch {
        /* non-JSON error */
      }
      throw new ApiError(res.status, body?.error.code ?? 'HTTP_ERROR', body?.error.message ?? `Request failed (${res.status})`, body?.error.details);
    }
    if (opts.raw) return (await res.blob()) as T;
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    config,
    refresh,
    url,
    get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
    post: <T>(path: string, body?: unknown, query?: Query) => request<T>('POST', path, { body: body ?? {}, query }),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),
    del: <T>(path: string) => request<T>('DELETE', path),
    upload: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
    blob: (path: string, query?: Query) => request<Blob>('GET', path, { query, raw: true }),
  };
}

export type Http = ReturnType<typeof createHttp>;
