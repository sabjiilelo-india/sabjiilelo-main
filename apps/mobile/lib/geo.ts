import { Linking } from 'react-native';
import * as Location from 'expo-location';
import type { LocateResult } from '@sabjiilelo/shared';
import { api } from './api';
import { confirm } from '../components/confirm';

export class GeoError extends Error {}

/**
 * Reads the phone's GPS position and resolves it to a pincode and delivery area.
 * Throws GeoError with a friendly message when permission is denied, GPS is off, or no fix arrives.
 */
export async function locateMe(): Promise<LocateResult> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    if (!perm.canAskAgain) {
      const open = await confirm({
        title: 'Location access is off',
        message: 'Allow location for Sabjii Le Lo in your phone settings to find your pincode automatically.',
        confirmText: 'Open settings',
        icon: 'location-outline',
      });
      if (open) Linking.openSettings().catch(() => undefined);
    }
    throw new GeoError('Location permission was not given. You can type your pincode instead.');
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new GeoError('Please turn on GPS / location services and try again.');
  }

  let pos: Location.LocationObject | null = null;
  try {
    // A balanced fix (city-block accuracy) is plenty for a pincode and arrives much faster than high accuracy.
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    pos = await Location.getLastKnownPositionAsync();
  }
  if (!pos) throw new GeoError("Couldn't get your position. Move to an open area or enter your pincode.");
  return api.catalog.locate(pos.coords.latitude, pos.coords.longitude);
}
