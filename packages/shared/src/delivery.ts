/** Straight-line distance between two points, in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export interface DeliveryEta {
  distanceKm: number;
  minMinutes: number;
  maxMinutes: number;
}

/** Hand-over time once the rider leaves: a few minutes to start, then about 3 minutes per km in town (roads are longer than the straight line). */
const ETA_BASE_MIN = 12;
const ETA_PER_KM_MIN = 3;
const ROAD_FACTOR = 1.3;

export function deliveryEta(distanceKm: number): DeliveryEta {
  const road = Math.max(0, distanceKm) * ROAD_FACTOR;
  const mid = ETA_BASE_MIN + road * ETA_PER_KM_MIN;
  const roundTo5 = (n: number) => Math.round(n / 5) * 5;
  const minMinutes = Math.max(10, roundTo5(mid - 4));
  const maxMinutes = Math.max(minMinutes + 5, roundTo5(mid + 6));
  return { distanceKm: Math.round(distanceKm * 10) / 10, minMinutes, maxMinutes };
}

export function formatEta(e: Pick<DeliveryEta, 'minMinutes' | 'maxMinutes'>): string {
  return `${e.minMinutes}–${e.maxMinutes} min`;
}
