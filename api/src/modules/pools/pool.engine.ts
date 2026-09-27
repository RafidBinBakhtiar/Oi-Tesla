import type { ActorType, Prisma, RideStatus, SubLocation } from '@prisma/client';
import { calculateFare, sameFare } from '../../domain/fare';
import {
  evaluateJoin,
  legHeadingDeg,
  type MatchResult,
  type Place,
  planRoute,
  type PoolSnapshot,
  type RiderLeg,
} from '../../domain/matching';
import {
  assertTransition,
  derivePoolStatus,
  IN_POOL_STATUSES,
  REQUOTABLE_STATUSES,
} from '../../domain/rideStateMachine';
import { RULES } from '../../domain/rules';
import { conflict, notFound } from '../../lib/errors';
import type { Tx } from '../../lib/prisma';

/**
 * Transaction-scoped pool operations. Every function here expects to run inside
 * prisma.$transaction and relies on row locks taken in a fixed order:
 *
 *     driver  →  pool  →  ride request
 *
 * so two concurrent requests for a car's last seat serialize on the pool row
 * and the second one re-evaluates against the first one's committed result.
 */

export const POOL_INCLUDE = {
  trajectory: true,
  currentSubLocation: true,
  vehicle: true,
  driver: { select: { id: true, name: true, phoneNumber: true, isOnline: true } },
  memberships: {
    orderBy: { joinedAt: 'asc' },
    include: {
      rideRequest: {
        include: { pickup: true, dropoff: true, passenger: { select: { id: true, name: true } } },
      },
    },
  },
} satisfies Prisma.PoolInclude;

export type PoolWithMembers = Prisma.PoolGetPayload<{ include: typeof POOL_INCLUDE }>;
type RideWithPlaces = Prisma.RideRequestGetPayload<{ include: { pickup: true; dropoff: true } }>;

export interface Actor {
  type: ActorType;
  id?: string;
}

// ── row locks ───────────────────────────────────────────────────────────────

export async function lockDriver(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM drivers WHERE id = ${id}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound('Driver not found');
}

export async function lockPool(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM pools WHERE id = ${id}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound('Pool not found');
}

export async function lockRide(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM ride_requests WHERE id = ${id}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound('Ride not found');
}

// ── mapping to the pure matching model ──────────────────────────────────────

export const toPlace = (s: SubLocation): Place => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lng: s.lng,
  locationId: s.locationId,
});

export const toLeg = (ride: RideWithPlaces): RiderLeg => ({
  rideId: ride.id,
  seats: ride.seatsRequested,
  pickup: toPlace(ride.pickup),
  dropoff: toPlace(ride.dropoff),
});

export const activeMembers = (pool: PoolWithMembers) =>
  pool.memberships.filter((m) => IN_POOL_STATUSES.includes(m.rideRequest.status));

export function snapshotOf(pool: PoolWithMembers): PoolSnapshot {
  if (!pool.trajectory) throw new Error(`Pool ${pool.id} has no trajectory`);
  return {
    status: pool.status,
    driverOnline: pool.driver.isOnline,
    capacity: pool.capacity,
    occupiedSeats: pool.occupiedSeats,
    origin: toPlace(pool.currentSubLocation),
    headingDeg: pool.trajectory.routeHeadingDeg,
    maxDetourSeconds: pool.trajectory.maxAllowableDetourSeconds,
    members: activeMembers(pool).map((m) => toLeg(m.rideRequest)),
  };
}

/** The stop order the driver should follow for the riders still in the pool. */
export function routePlanOf(pool: PoolWithMembers) {
  const legs = activeMembers(pool).map((m) => toLeg(m.rideRequest));
  return planRoute(toPlace(pool.currentSubLocation), legs, Number.POSITIVE_INFINITY);
}

// ── audit + fares ───────────────────────────────────────────────────────────

export async function recordEvent(
  tx: Tx,
  e: { rideRequestId: string; poolId?: string | null; from: RideStatus | null; to: RideStatus; actor: Actor; note?: string },
) {
  await tx.rideStatusEvent.create({
    data: {
      rideRequestId: e.rideRequestId,
      poolId: e.poolId ?? null,
      fromStatus: e.from,
      toStatus: e.to,
      actorType: e.actor.type,
      actorId: e.actor.id ?? null,
      note: e.note?.slice(0, 300),
    },
  });
}

export const latestFare = (tx: Tx, rideRequestId: string) =>
  tx.fareCalculation.findFirst({ where: { rideRequestId }, orderBy: { calculatedAt: 'desc' } });

/**
 * Re-prices every member who has not been picked up yet. Fares lock at pickup,
 * so a co-rider cancelling later never changes the price of someone on board.
 * Writes a new QUOTE row only when the price actually changes.
 */
export async function requoteMembers(tx: Tx, poolId: string) {
  const memberships = await tx.poolMembership.findMany({ where: { poolId }, include: { rideRequest: true } });
  const sharing = memberships.filter((m) => m.rideRequest.status !== 'CANCELLED');

  for (const { rideRequest: ride } of sharing) {
    if (!REQUOTABLE_STATUSES.includes(ride.status)) continue;
    const fare = calculateFare({
      distanceM: ride.distanceM,
      seats: ride.seatsRequested,
      coRiderCount: sharing.length - 1,
    });
    const latest = await latestFare(tx, ride.id);
    if (latest?.kind === 'QUOTE' && sameFare(latest, fare)) continue;
    // Timestamp taken now (after the lock), not at transaction start, so the
    // "latest fare" ordering matches the order in which locks were granted.
    await tx.fareCalculation.create({ data: { rideRequestId: ride.id, kind: 'QUOTE', ...fare, calculatedAt: new Date() } });
  }
}

// ── pool bookkeeping ────────────────────────────────────────────────────────

/**
 * Recomputes everything about a pool that is derived from its members:
 * occupied seats, status (+ timestamps) and, while still OPEN, the trajectory
 * anchor (if the rider who set the direction cancelled, the next one does).
 */
export async function settlePool(tx: Tx, poolId: string) {
  const pool = await tx.pool.findUniqueOrThrow({ where: { id: poolId }, include: POOL_INCLUDE });
  const active = activeMembers(pool);
  const status = derivePoolStatus(pool.memberships.map((m) => m.rideRequest.status));
  const now = new Date();

  const data: Prisma.PoolUncheckedUpdateInput = {
    occupiedSeats: active.reduce((sum, m) => sum + m.seats, 0),
  };
  if (status !== pool.status) {
    data.status = status;
    if (status === 'IN_PROGRESS' && !pool.startedAt) data.startedAt = now;
    if (status === 'COMPLETED') data.completedAt = now;
    if (status === 'CANCELLED') data.cancelledAt = now;
  }

  const anchor = active[0]?.rideRequest;
  const trajectory = pool.trajectory;
  if (
    status === 'OPEN' &&
    anchor &&
    trajectory &&
    (trajectory.originSubLocationId !== anchor.pickupSubLocationId ||
      trajectory.primaryDestinationSubLocationId !== anchor.dropoffSubLocationId)
  ) {
    await tx.spatialTrajectory.update({
      where: { poolId },
      data: {
        originSubLocationId: anchor.pickupSubLocationId,
        primaryDestinationSubLocationId: anchor.dropoffSubLocationId,
        routeHeadingDeg: legHeadingDeg(toLeg(anchor)),
      },
    });
    data.currentSubLocationId = anchor.pickupSubLocationId;
  }

  // The CHECK (occupied_seats BETWEEN 0 AND capacity) constraint backs this up.
  await tx.pool.update({ where: { id: poolId }, data });
}

// ── joining ─────────────────────────────────────────────────────────────────

/**
 * Tries to put a REQUESTED ride into an existing pool. Locks pool then ride,
 * re-runs the full matching rule on fresh data and only then writes.
 * Returns the match result; on failure nothing is written.
 */
export async function joinPool(tx: Tx, poolId: string, rideId: string, actor: Actor): Promise<MatchResult> {
  await lockPool(tx, poolId);
  await lockRide(tx, rideId);

  const pool = await tx.pool.findUniqueOrThrow({ where: { id: poolId }, include: POOL_INCLUDE });
  const ride = await tx.rideRequest.findUniqueOrThrow({ where: { id: rideId }, include: { pickup: true, dropoff: true } });
  if (ride.status !== 'REQUESTED') throw conflict('This ride is no longer waiting for a match', 'RIDE_NOT_WAITING');

  const result = evaluateJoin(snapshotOf(pool), toLeg(ride));
  if (!result.ok) return result;

  assertTransition('REQUESTED', 'MATCHED', actor.type);
  await tx.poolMembership.create({ data: { poolId, rideRequestId: rideId, seats: ride.seatsRequested } });
  await tx.rideRequest.update({ where: { id: rideId }, data: { status: 'MATCHED', matchedAt: new Date() } });
  await recordEvent(tx, {
    rideRequestId: rideId,
    poolId,
    from: 'REQUESTED',
    to: 'MATCHED',
    actor,
    note:
      actor.type === 'SYSTEM'
        ? `Pooled into ${pool.vehicle.modelName} with ${activeMembers(pool).length} other rider(s), +${result.addedSeconds}s route`
        : `Added to ${pool.vehicle.modelName}'s pool by ${pool.driver.name}`,
  });
  await settlePool(tx, poolId);
  await requoteMembers(tx, poolId);
  return result;
}

/** Starts a brand-new pool on the driver's Tesla with this ride as its anchor. */
export async function openPool(
  tx: Tx,
  driver: { id: string; name: string; vehicle: { id: string; modelName: string; capacity: number } },
  rideId: string,
) {
  await lockRide(tx, rideId);
  const ride = await tx.rideRequest.findUniqueOrThrow({ where: { id: rideId }, include: { pickup: true, dropoff: true } });
  if (ride.status !== 'REQUESTED') throw conflict('This ride is no longer waiting for a match', 'RIDE_NOT_WAITING');
  if (ride.seatsRequested > driver.vehicle.capacity) {
    throw conflict(`${driver.vehicle.modelName} only has ${driver.vehicle.capacity} seats`, 'NO_SEATS');
  }

  // The partial unique index "pools_one_active_per_vehicle" rejects a second
  // active pool for the same Tesla even if two accepts race past our checks.
  const pool = await tx.pool.create({
    data: {
      vehicleId: driver.vehicle.id,
      driverId: driver.id,
      currentSubLocationId: ride.pickupSubLocationId,
      capacity: driver.vehicle.capacity,
      occupiedSeats: 0,
      status: 'OPEN',
      trajectory: {
        create: {
          originSubLocationId: ride.pickupSubLocationId,
          primaryDestinationSubLocationId: ride.dropoffSubLocationId,
          routeHeadingDeg: legHeadingDeg(toLeg(ride)),
          maxAllowableDetourSeconds: RULES.MAX_DETOUR_SECONDS,
        },
      },
    },
  });

  await tx.poolMembership.create({ data: { poolId: pool.id, rideRequestId: rideId, seats: ride.seatsRequested } });
  await tx.rideRequest.update({ where: { id: rideId }, data: { status: 'MATCHED', matchedAt: new Date() } });
  await recordEvent(tx, {
    rideRequestId: rideId,
    poolId: pool.id,
    from: 'REQUESTED',
    to: 'MATCHED',
    actor: { type: 'DRIVER', id: driver.id },
    note: `${driver.name} accepted with ${driver.vehicle.modelName}`,
  });
  await settlePool(tx, pool.id);
  await requoteMembers(tx, pool.id);
  return pool.id;
}
