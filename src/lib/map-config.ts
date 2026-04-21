// Map view constants. Coordinates for the school are fixed — they come from a
// one-off geocode of the hardcoded address in src/lib/commute.ts.

/** [latitude, longitude] of the school, hardcoded from a single geocode. */
export const SCHOOL_COORDS: [number, number] = [45.64896917173701, -73.64043471667857]

/** Approximate radius (km) of a 20-minute drive from the school. */
export const COMMUTE_ZONE_KM = 15

/** Initial map center when no listings are visible yet. */
export const DEFAULT_MAP_CENTER: [number, number] = SCHOOL_COORDS

/** Initial map zoom when no listings are visible yet. */
export const DEFAULT_MAP_ZOOM = 10
