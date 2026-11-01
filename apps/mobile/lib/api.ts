import { storage } from './storage';
import Constants from 'expo-constants';
import { createApi, type TokenStore } from '@sabjiilelo/api-client';
import type { AuthResponse } from '@sabjiilelo/shared';

/**
 * In development the phone reaches the API on the same machine that runs Metro,
 * so the host is taken from the Expo dev server address. Set EXPO_PUBLIC_API_URL for builds.
 */
function apiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000/api`;
}

export const API_URL = apiBaseUrl();
/** Origin of the API, for brand images served from /static. */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const REFRESH_KEY = 'sl_refresh';
let accessToken: string | null = null;
const listeners = new Set<(auth: AuthResponse | null) => void>();

export const tokenStore: TokenStore = {
  getAccess: () => accessToken,
  getRefresh: () => storage.get(REFRESH_KEY),
  async save(auth) {
    accessToken = auth.accessToken;
    await storage.set(REFRESH_KEY, auth.refreshToken);
    listeners.forEach((l) => l(auth));
  },
  async clear() {
    accessToken = null;
    await storage.remove(REFRESH_KEY);
    listeners.forEach((l) => l(null));
  },
};

export function onAuthChange(fn: (auth: AuthResponse | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const api = createApi({ baseUrl: API_URL, client: 'app', store: tokenStore });

/** Builds a multipart body for an image picked with expo-image-picker. */
export function imageForm(uri: string): FormData {
  const name = uri.split('/').pop() ?? 'photo.jpg';
  const ext = name.split('.').pop()?.toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const form = new FormData();
  // React Native's FormData accepts this file descriptor shape.
  form.append('file', { uri, name, type } as unknown as Blob);
  return form;
}
