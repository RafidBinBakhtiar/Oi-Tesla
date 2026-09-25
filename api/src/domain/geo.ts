import { RULES } from './rules';

export interface Point {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Equirectangular projection of b relative to a, in metres (east, north).
 * At city scale this is within centimetres of haversine and far easier to
 * reason about — and it gives distance and bearing from the same numbers.
 */
function offsetMetres(a: Point, b: Point) {
  const meanLat = toRad((a.lat + b.lat) / 2);
  return {
    east: toRad(b.lng - a.lng) * Math.cos(meanLat) * EARTH_RADIUS_M,
    north: toRad(b.lat - a.lat) * EARTH_RADIUS_M,
  };
}

/** Straight-line distance in whole metres. */
export function distanceM(a: Point, b: Point): number {
  const { east, north } = offsetMetres(a, b);
  return Math.round(Math.hypot(east, north));
}

/** Compass bearing from a to b: 0 = north, 90 = east, in [0, 360). */
export function bearingDeg(a: Point, b: Point): number {
  const { east, north } = offsetMetres(a, b);
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** Smallest angle between two bearings, in [0, 180]. 350° vs 10° → 20°. */
export function headingDeltaDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Travel time in seconds at the average Dhaka speed (20 km/h → 0.18 s/m). */
export function travelSeconds(metres: number): number {
  return (metres * 3.6) / RULES.AVG_SPEED_KMH;
}
