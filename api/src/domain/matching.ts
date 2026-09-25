import type { PoolStatus } from '@prisma/client';
import { bearingDeg, distanceM, headingDeltaDeg, type Point, travelSeconds } from './geo';
import { RULES } from './rules';

/**
 * The pooling engine, as pure functions. Given a snapshot of a pool and a
 * candidate ride, decide whether the ride fits and, if so, the route the
 * driver should take. No I/O here — the database layer takes a row lock,
 * builds the snapshot, and calls evaluateJoin (see modules/pools/pool.engine.ts).
 */

export interface Place extends Point {
  id: string;
  name: string;
  /** Zone / cluster id. */
  locationId: string;
}

export interface RiderLeg {
  rideId: string;
  seats: number;
  pickup: Place;
  dropoff: Place;
}

export interface PoolSnapshot {
  status: PoolStatus;
  driverOnline: boolean;
  capacity: number;
  occupiedSeats: number;
  origin: Place;
  headingDeg: number;
  maxDetourSeconds: number;
  /** Riders currently holding seats. */
  members: RiderLeg[];
}

export interface RouteStop {
  kind: 'PICKUP' | 'DROPOFF';
  place: Place;
  rideIds: string[];
}

export interface RiderDetour {
  rideId: string;
  directM: number;
  riddenM: number;
  extraSeconds: number;
}

export interface RoutePlan {
  stops: RouteStop[];
  totalDistanceM: number;
  detours: RiderDetour[];
}

export type MatchFailureCode =
  | 'POOL_CLOSED'
  | 'DRIVER_OFFLINE'
  | 'DIFFERENT_CLUSTER'
  | 'HEADING_MISMATCH'
  | 'NO_SEATS'
  | 'DETOUR_TOO_LONG';

export type MatchResult =
  | { ok: true; plan: RoutePlan; addedSeconds: number }
  | { ok: false; code: MatchFailureCode; reason: string };

/** Rules are checked cheapest-first; the first failure is the reason we report. */
export function evaluateJoin(pool: PoolSnapshot, candidate: RiderLeg): MatchResult {
  if (pool.status !== 'OPEN') {
    return fail('POOL_CLOSED', 'This Tesla has already picked riders up and is not taking new ones');
  }
  if (!pool.driverOnline) return fail('DRIVER_OFFLINE', 'The driver is offline');

  if (candidate.pickup.locationId !== pool.origin.locationId) {
    return fail('DIFFERENT_CLUSTER', `Pickup ${candidate.pickup.name} is outside this pool's zone`);
  }

  const heading = bearingDeg(candidate.pickup, candidate.dropoff);
  const delta = headingDeltaDeg(heading, pool.headingDeg);
  if (delta > RULES.MAX_HEADING_DELTA_DEG) {
    return fail(
      'HEADING_MISMATCH',
      `Heading differs by ${Math.round(delta)}° (max ${RULES.MAX_HEADING_DELTA_DEG}°) — going the other way`,
    );
  }

  const free = pool.capacity - pool.occupiedSeats;
  if (candidate.seats > free) {
    return fail('NO_SEATS', `Only ${free} of ${pool.capacity} seats left, ${candidate.seats} requested`);
  }

  const plan = planRoute(pool.origin, [...pool.members, candidate], pool.maxDetourSeconds);
  if (!plan) {
    return fail(
      'DETOUR_TOO_LONG',
      `No drop-off order keeps every rider within ${pool.maxDetourSeconds / 60} min of their solo trip`,
    );
  }

  const before = planRoute(pool.origin, pool.members, Number.POSITIVE_INFINITY);
  const addedSeconds = Math.round(travelSeconds(plan.totalDistanceM - (before?.totalDistanceM ?? 0)));
  return { ok: true, plan, addedSeconds };
}

/**
 * Builds the pooled route: all pickups first (origin, then nearest-first),
 * then drop-offs in whichever order is shortest while keeping every rider's
 * extra time ≤ maxDetourSeconds. Returns null if no order satisfies everyone.
 *
 * Pools hold at most a handful of riders, so trying every drop-off
 * permutation (≤ 3! = 6 for Bullet) is both optimal and cheap.
 */
export function planRoute(origin: Place, legs: RiderLeg[], maxDetourSeconds: number): RoutePlan | null {
  if (legs.length === 0) return { stops: [], totalDistanceM: 0, detours: [] };

  const pickups = groupStops('PICKUP', legs, (l) => l.pickup);
  pickups.sort((a, b) => {
    if (a.place.id === origin.id) return -1;
    if (b.place.id === origin.id) return 1;
    return distanceM(origin, a.place) - distanceM(origin, b.place);
  });
  const dropoffs = groupStops('DROPOFF', legs, (l) => l.dropoff);

  let best: RoutePlan | null = null;
  for (const order of permutations(dropoffs)) {
    const stops = [...pickups, ...order];
    const cumulative = cumulativeDistances(stops);
    const detours = legs.map((leg) => {
      const pickIdx = stops.findIndex((s) => s.kind === 'PICKUP' && s.rideIds.includes(leg.rideId));
      const dropIdx = stops.findIndex((s) => s.kind === 'DROPOFF' && s.rideIds.includes(leg.rideId));
      const riddenM = cumulative[dropIdx]! - cumulative[pickIdx]!;
      const directM = distanceM(leg.pickup, leg.dropoff);
      return { rideId: leg.rideId, directM, riddenM, extraSeconds: Math.round(travelSeconds(riddenM - directM)) };
    });
    if (detours.some((d) => d.extraSeconds > maxDetourSeconds)) continue;

    const totalDistanceM = cumulative[cumulative.length - 1]!;
    if (!best || totalDistanceM < best.totalDistanceM) best = { stops, totalDistanceM, detours };
  }
  return best;
}

export function legHeadingDeg(leg: Pick<RiderLeg, 'pickup' | 'dropoff'>): number {
  return Math.round(bearingDeg(leg.pickup, leg.dropoff)) % 360;
}

function groupStops(kind: RouteStop['kind'], legs: RiderLeg[], placeOf: (l: RiderLeg) => Place): RouteStop[] {
  const byPlace = new Map<string, RouteStop>();
  for (const leg of legs) {
    const place = placeOf(leg);
    const stop = byPlace.get(place.id) ?? { kind, place, rideIds: [] };
    stop.rideIds.push(leg.rideId);
    byPlace.set(place.id, stop);
  }
  return [...byPlace.values()];
}

function cumulativeDistances(stops: RouteStop[]): number[] {
  const out = [0];
  for (let i = 1; i < stops.length; i++) out.push(out[i - 1]! + distanceM(stops[i - 1]!.place, stops[i]!.place));
  return out;
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items.slice();
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) yield [items[i]!, ...perm];
  }
}

const fail = (code: MatchFailureCode, reason: string): MatchResult => ({ ok: false, code, reason });
