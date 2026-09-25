import type { RideStatus } from '@prisma/client';
import { estimateFare } from '../../domain/fare';
import { evaluateJoin } from '../../domain/matching';
import { assertTransition } from '../../domain/rideStateMachine';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma, type Tx } from '../../lib/prisma';
import { getProfile } from '../auth/auth.service';
import {
  joinPool,
  latestFare,
  lockDriver,
  lockPool,
  lockRide,
  openPool,
  POOL_INCLUDE,
  recordEvent,
  settlePool,
  snapshotOf,
  toLeg,
} from '../pools/pool.engine';
import { DRIVER_POOL_INCLUDE, driverPoolView } from './driver.views';

const ACTIVE_POOL = { in: ['OPEN', 'IN_PROGRESS'] as ('OPEN' | 'IN_PROGRESS')[] };

const findActivePool = (db: Tx | typeof prisma, driverId: string) =>
  db.pool.findFirst({ where: { driverId, status: ACTIVE_POOL }, include: POOL_INCLUDE });

const taka = (paisa: number) => `৳${(paisa / 100).toFixed(2)}`;

// ── availability ────────────────────────────────────────────────────────────

export async function setAvailability(driverId: string, input: { online: boolean; subLocationId?: string }) {
  await prisma.$transaction(async (tx) => {
    await lockDriver(tx, driverId);
    const driver = await tx.driver.findUniqueOrThrow({ where: { id: driverId } });
    const active = await findActivePool(tx, driverId);

    if (!input.online) {
      if (active) throw conflict('Finish your current pool before going offline', 'ACTIVE_POOL');
      await tx.driver.update({ where: { id: driverId }, data: { isOnline: false } });
      return;
    }

    const target = input.subLocationId ?? driver.currentSubLocationId;
    if (!target) throw badRequest('Tell us where Bullet is parked to go online', 'LOCATION_REQUIRED');
    if (input.subLocationId) {
      const exists = await tx.subLocation.findUnique({ where: { id: input.subLocationId } });
      if (!exists) throw badRequest('Unknown location', 'UNKNOWN_LOCATION');
    }
    if (active && target !== driver.currentSubLocationId) {
      throw conflict('You cannot move while you have riders assigned', 'ACTIVE_POOL');
    }
    await tx.driver.update({ where: { id: driverId }, data: { isOnline: true, currentSubLocationId: target } });
  });
  return getProfile({ id: driverId, role: 'driver' });
}

// ── requests ────────────────────────────────────────────────────────────────

/**
 * REQUESTED rides whose pickup is in the driver's zone, each annotated with
 * whether the driver can take it right now and, if not, why.
 */
export async function listRelevantRequests(driverId: string) {
  const driver = await prisma.driver.findUniqueOrThrow({
    where: { id: driverId },
    include: { vehicle: true, currentSubLocation: { include: { location: true } } },
  });
  if (!driver.isOnline || !driver.currentSubLocation) {
    return { online: driver.isOnline, zone: null, requests: [] };
  }

  const zone = driver.currentSubLocation.location;
  const active = await findActivePool(prisma, driverId);
  const rides = await prisma.rideRequest.findMany({
    where: { status: 'REQUESTED', pickup: { locationId: zone.id } },
    include: { pickup: true, dropoff: true, passenger: { select: { name: true } } },
    orderBy: { requestedAt: 'asc' },
    take: 50,
  });

  const requests = rides.map((ride) => {
    let canAccept = true;
    let reason: string | null = null;
    if (active?.status === 'IN_PROGRESS') {
      canAccept = false;
      reason = 'Finish your current trip first — riders are already on board';
    } else if (active) {
      const result = evaluateJoin(snapshotOf(active), toLeg(ride));
      canAccept = result.ok;
      reason = result.ok ? `Fits your pool (+${Math.round(result.addedSeconds / 60)} min route)` : result.reason;
    } else if (!driver.vehicle || ride.seatsRequested > driver.vehicle.capacity) {
      canAccept = false;
      reason = 'Needs more seats than your Tesla has';
    }
    const { solo, pooled } = estimateFare(ride.distanceM, ride.seatsRequested);
    return {
      rideId: ride.id,
      passengerName: ride.passenger.name,
      seats: ride.seatsRequested,
      pickup: { id: ride.pickup.id, name: ride.pickup.name },
      dropoff: { id: ride.dropoff.id, name: ride.dropoff.name },
      distanceM: ride.distanceM,
      requestedAt: ride.requestedAt,
      soloFarePaisa: solo.finalFarePaisa,
      pooledFarePaisa: pooled.finalFarePaisa,
      canAccept,
      reason,
    };
  });

  return { online: true, zone: { id: zone.id, name: zone.name }, requests };
}

export async function acceptRequest(driverId: string, rideId: string) {
  const poolId = await prisma.$transaction(async (tx) => {
    // Driver lock first: two taps on "Accept" (or two requests) cannot both
    // decide "no active pool yet" and open two pools for Bullet.
    await lockDriver(tx, driverId);
    const driver = await tx.driver.findUniqueOrThrow({
      where: { id: driverId },
      include: { vehicle: true, currentSubLocation: true },
    });
    if (!driver.isOnline) throw conflict('Go online before accepting rides', 'DRIVER_OFFLINE');
    if (!driver.vehicle) throw conflict('No Tesla is registered to you', 'NO_VEHICLE');

    const active = await tx.pool.findFirst({ where: { driverId, status: ACTIVE_POOL } });
    if (active?.status === 'IN_PROGRESS') {
      throw conflict('Finish your current trip first — riders are already on board', 'POOL_IN_PROGRESS');
    }
    if (active) {
      const result = await joinPool(tx, active.id, rideId, { type: 'DRIVER', id: driverId });
      if (!result.ok) throw conflict(result.reason, result.code);
      return active.id;
    }

    const ride = await tx.rideRequest.findUnique({ where: { id: rideId }, include: { pickup: true } });
    if (!ride) throw notFound('Ride not found');
    if (driver.currentSubLocation && ride.pickup.locationId !== driver.currentSubLocation.locationId) {
      throw conflict(`${ride.pickup.name} is outside your zone`, 'DIFFERENT_CLUSTER');
    }
    return openPool(tx, { id: driver.id, name: driver.name, vehicle: driver.vehicle }, rideId);
  });
  return getPoolView(poolId);
}

// ── trip progress ───────────────────────────────────────────────────────────

type DriverStep = Extract<RideStatus, 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED'>;

export async function advanceRide(driverId: string, rideId: string, to: DriverStep) {
  const membership = await prisma.poolMembership.findUnique({
    where: { rideRequestId: rideId },
    select: { poolId: true, pool: { select: { driverId: true } } },
  });
  // Rides outside the driver's own pools look exactly like missing rides.
  if (!membership || membership.pool.driverId !== driverId) throw notFound('Ride not found in your pool');
  const { poolId } = membership;

  await prisma.$transaction(async (tx) => {
    await lockPool(tx, poolId);
    await lockRide(tx, rideId);
    const ride = await tx.rideRequest.findUniqueOrThrow({
      where: { id: rideId },
      include: { pickup: true, dropoff: true, passenger: true, membership: true },
    });
    assertTransition(ride.status, to, 'DRIVER');

    const now = new Date();
    let note: string;
    if (to === 'DRIVER_ARRIVED') {
      await tx.rideRequest.update({ where: { id: rideId }, data: { status: to, arrivedAt: now } });
      note = `Arrived at ${ride.pickup.name} for ${ride.passenger.name}`;
    } else if (to === 'STARTED') {
      await tx.rideRequest.update({ where: { id: rideId }, data: { status: to, startedAt: now } });
      note = `${ride.passenger.name} picked up; fare locked`;
    } else {
      await tx.rideRequest.update({ where: { id: rideId }, data: { status: to, completedAt: now } });
      await tx.poolMembership.update({ where: { rideRequestId: rideId }, data: { leftAt: now } });
      await tx.driver.update({ where: { id: driverId }, data: { currentSubLocationId: ride.dropoffSubLocationId } });
      const paid = await settlePayment(tx, ride);
      note = `Dropped at ${ride.dropoff.name}; ${taka(paid.amountPaisa)} via ${paid.method}${paid.note ? ` (${paid.note})` : ''}`;
    }

    await recordEvent(tx, {
      rideRequestId: rideId,
      poolId,
      from: ride.status,
      to,
      actor: { type: 'DRIVER', id: driverId },
      note,
    });
    await settlePool(tx, poolId);
  });

  return getPoolView(poolId);
}

/** Freezes the fare as FINAL and records payment; TeslaPay is debited atomically. */
async function settlePayment(
  tx: Tx,
  ride: { id: string; passengerId: string; paymentMethod: 'CASH' | 'TESLAPAY' },
) {
  const quote = await latestFare(tx, ride.id);
  if (!quote) throw new Error(`Ride ${ride.id} has no fare`);
  const { id: _id, calculatedAt: _at, kind: _kind, ...fare } = quote;
  await tx.fareCalculation.create({ data: { ...fare, kind: 'FINAL', calculatedAt: new Date() } });

  const amountPaisa = quote.finalFarePaisa;
  let method = ride.paymentMethod;
  let note: string | null = null;
  if (method === 'TESLAPAY') {
    // Conditional decrement: never takes the wallet below zero, even under races.
    const debit = await tx.passenger.updateMany({
      where: { id: ride.passengerId, walletBalancePaisa: { gte: amountPaisa } },
      data: { walletBalancePaisa: { decrement: amountPaisa } },
    });
    if (debit.count === 0) {
      method = 'CASH';
      note = 'TeslaPay balance too low at drop-off, collected in cash';
    }
  }
  await tx.payment.create({ data: { rideRequestId: ride.id, passengerId: ride.passengerId, method, amountPaisa, note } });
  return { method, amountPaisa, note };
}

// ── views ───────────────────────────────────────────────────────────────────

async function getPoolView(poolId: string) {
  const pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId }, include: DRIVER_POOL_INCLUDE });
  return driverPoolView(pool);
}

export async function getCurrentPool(driverId: string) {
  const pool = await prisma.pool.findFirst({
    where: { driverId, status: ACTIVE_POOL },
    include: DRIVER_POOL_INCLUDE,
  });
  return pool ? driverPoolView(pool) : null;
}

export async function listPoolHistory(driverId: string, limit: number) {
  const pools = await prisma.pool.findMany({
    where: { driverId },
    include: DRIVER_POOL_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return pools.map(driverPoolView);
}
