import type { LocateResult } from '@sabjiilelo/shared';
import { api } from './api';

export class GeoError extends Error {}

/** Reads the browser's position and resolves it to a pincode and delivery area. */
export async function locateMe(): Promise<LocateResult> {
  if (!('geolocation' in navigator)) throw new GeoError('This browser cannot share your location. Please enter your pincode.');
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 }),
  ).catch((e: GeolocationPositionError) => {
    if (e.code === e.PERMISSION_DENIED) throw new GeoError('Location access is blocked. Allow it in your browser (lock icon next to the address bar) or enter your pincode.');
    if (e.code === e.TIMEOUT) throw new GeoError('Finding your location took too long. Please try again or enter your pincode.');
    throw new GeoError("Couldn't get your location. Please enter your pincode.");
  });
  return api.catalog.locate(pos.coords.latitude, pos.coords.longitude);
}
