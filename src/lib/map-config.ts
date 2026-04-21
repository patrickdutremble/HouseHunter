// Map view constants. Coordinates for the school are fixed — they come from a
// one-off geocode of the hardcoded address in src/lib/commute.ts.

/** [latitude, longitude] of the school, hardcoded from a single geocode. */
export const SCHOOL_COORDS: [number, number] = [45.64896917173701, -73.64043471667857]

/** Inner commute zone radius (km). Listings inside get a teal dot. */
export const INNER_COMMUTE_ZONE_KM = 10

/** Outer commute zone radius (km). Listings between inner and outer get a yellow dot. */
export const OUTER_COMMUTE_ZONE_KM = 15

/** Initial map center when no listings are visible yet. */
export const DEFAULT_MAP_CENTER: [number, number] = SCHOOL_COORDS

/** Initial map zoom when no listings are visible yet. */
export const DEFAULT_MAP_ZOOM = 10

/** Great-circle distance in kilometers between two [lat, lon] points. */
export function distanceKm(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number]
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
