import { logger } from '../lib/logger';

export interface ReverseResult {
  pincode: string | null;
  city: string | null;
  state: string | null;
  line1: string | null;
  displayName: string | null;
}

/**
 * GPS coordinates -> address, using OpenStreetMap's free Nominatim service.
 * Its usage policy asks for an identifying User-Agent and light use (about 1 request/second),
 * which the route-level rate limit and the small in-memory cache below respect.
 */
const cache = new Map<string, { at: number; value: ReverseResult }>();
const TTL_MS = 10 * 60 * 1000;

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseResult> {
  // ~110 m grid: neighbouring requests reuse each other's answer.
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SabjiiLeLo/1.0 (support@sabjiilelo.in)', Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) {
    logger.warn({ status: res.status }, 'reverse geocode failed');
    throw new Error(`Geocoder returned ${res.status}`);
  }
  const data = (await res.json()) as { display_name?: string; address?: Record<string, string> };
  const a = data.address ?? {};
  const pin = (a.postcode ?? '').replace(/\s+/g, '');
  const value: ReverseResult = {
    pincode: /^\d{6}$/.test(pin) ? pin : null,
    city: a.city ?? a.town ?? a.village ?? a.county ?? a.state_district ?? null,
    state: a.state ?? null,
    line1: [a.house_number, a.road ?? a.pedestrian, a.neighbourhood ?? a.suburb ?? a.quarter].filter(Boolean).join(', ') || null,
    displayName: data.display_name ?? null,
  };
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}
