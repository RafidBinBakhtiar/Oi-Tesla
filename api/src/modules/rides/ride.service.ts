import { Prisma } from '@prisma/client';
import { estimateFare } from '../../domain/fare';
import { distanceM, travelSeconds } from '../../domain/geo';
import { evaluateJoin, type MatchResult } from '../../domain/matching';
import { ACTIVE_RIDE_STATUSES, assertTransition } from '../../domain/rideStateMachine';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import {
  joinPool,
  lockPool,
  lockRide,
  POOL_INCLUDE,
  recordEvent,
  requoteMembers,
  settlePool,
  snapshotOf,
  toLeg,
} from '../pools/pool.engine';
import { PASSENGER_RIDE_DETAIL_INCLUDE, PASSENGER_RIDE_INCLUDE, passengerRideDetailView, passengerRideView } from './ride.views';

async function loadTrip(pickupId: string, dropoffId: string) {
  const [pickup, dropoff] = await Promise.all([
    prisma.subLocation.findUnique({ where: { id: pickupId } }),
    prisma.subLocation.findUnique({ where: { id: dropoffId } }),
  ]);
  if (!pickup || !dropoff) throw badRequest('Unknown pickup or drop-off location', 'UNKNOWN_LOCATION');
  const metres = distanceM(pickup, dropoff);
  if (metres <= 0) throw badRequest('Pickup and drop-off must differ', 'SAME_LOCATION');
  return { pickup, dropoff, distanceM: metres };
}

export async function estimate(input: { pickupId: string; dropoffId: string; seats: number }) {
  const trip = await loadTrip(input.pickupId, input.dropoffId);
  const { solo, pooled } = estimateFare(trip.distanceM, input.seats);
  return {
    pickup: { id: trip.pickup.id, name: trip.pickup.name },
    dropoff: { id: trip.dropoff.id, name: trip.dropoff.name },
    distanceM: trip.distanceM,
    soloDurationSeconds: Math.round(travelSeconds(trip.distanceM)),
    solo,
    pooled,
  };
}

export async function createRide(
  passengerId: string,
  input: { pickupId: string; dropoffId: string; seats: number; paymentMethod: 'CASH' | 'TESLAPAY' },
) {
  const trip = await loadTrip(input.pickupId, input.dropoffId);
  const { solo } = estimateFare(trip.distanceM, input.seats);

  const active = await prisma.rideRequest.findFirst({
    where: { passengerId, status: { in: [...ACTIVE_RIDE_STATUSES] } },
    select: { id: true },
  });
  if (active) throw conflict('You already have a ride in progress', 'ACTIVE_RIDE_EXISTS', { rideId: active.id });

  if (input.paymentMethod === 'TESLAPAY') {
    const passenger = await prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    // The solo estimate is the most this ride can ever cost, so checking it
    // now guarantees the debit at drop-off cannot fail.
    if (passenger.walletBalancePaisa < solo.finalFarePaisa) {
      throw new AppError(422, 'INSUFFICIENT_BALANCE', 'Not enough TeslaPay balance for this trip — pay cash instead', {
        balancePaisa: passenger.walletBalancePaisa,
        requiredPaisa: solo.finalFarePaisa,
      });
    }
  }

  let rideId: string;
  try {
    rideId = await prisma.$transaction(async (tx) => {
      const ride = await tx.rideRequest.create({
        data: {
          passengerId,
          pickupSubLocationId: trip.pickup.id,
          dropoffSubLocationId: trip.dropoff.id,
          seatsRequested: input.seats,
          distanceM: trip.distanceM,
          paymentMethod: input.paymentMethod,
        },
      });
      await tx.fareCalculation.create({ data: { rideRequestId: ride.id, kind: 'ESTIMATE', ...solo } });
      await recordEvent(tx, {
        rideRequestId: ride.id,
        from: null,
        to: 'REQUESTED',
        actor: { type: 'PASSENGER', id: passengerId },
        note: `${trip.pickup.name} → ${trip.dropoff.name}, ${input.seats} seat(s)`,
      });
      return ride.id;
    });
  } catch (err) {
    // Two double-clicked "Request" buttons: the partial unique index lets only one through.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('You already have a ride in progress', 'ACTIVE_RIDE_EXISTS');
    }
    throw err;
  }

  const autoMatch = await tryAutoMatch(rideId);
  return { ride: await getMyRide(passengerId, rideId), autoMatch };
}

/**
 * Looks for an OPEN pool in the same pickup zone that this ride fits into.
 * Candidates are ranked on a lock-free snapshot (least added route time first),
 * then each is re-checked under the pool's row lock before joining.
 */
export async function tryAutoMatch(rideId: string) {
  const ride = await prisma.rideRequest.findUnique({ where: { id: rideId }, include: { pickup: true, dropoff: true } });
  if (!ride || ride.status !== 'REQUESTED') return { matched: false, poolsConsidered: 0, reason: null };

  const pools = await prisma.pool.findMany({
    where: { status: 'OPEN', currentSubLocation: { locationId: ride.pickup.locationId }, driver: { isOnline: true } },
    include: POOL_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
  if (pools.length === 0) {
    return { matched: false, poolsConsidered: 0, reason: 'No Tesla has an open pool near your pickup yet' };
  }

  const evaluated = pools.map((pool) => ({ pool, result: evaluateJoin(snapshotOf(pool), toLeg(ride)) }));
  const candidates = evaluated
    .flatMap(({ pool, result }) => (result.ok ? [{ pool, addedSeconds: result.addedSeconds }] : []))
    .sort((a, b) => a.addedSeconds - b.addedSeconds);

  const firstFailure = evaluated
    .map((e) => e.result)
    .find((r): r is Extract<MatchResult, { ok: false }> => !r.ok);
  let lastReason: string | null = firstFailure?.reason ?? null;

  for (const { pool } of candidates) {
    try {
      const result = await prisma.$transaction((tx) => joinPool(tx, pool.id, ride.id, { type: 'SYSTEM' }));
      if (result.ok) {
        logger.info({ rideId, poolId: pool.id }, 'auto-matched ride into pool');
        return { matched: true, poolsConsidered: pools.length, reason: null };
      }
      // Someone else took the seat between our snapshot and the lock.
      lastReason = result.reason;
    } catch (err) {
      if (err instanceof AppError && err.code === 'RIDE_NOT_WAITING') break; // cancelled or accepted meanwhile
      throw err;
    }
  }
  return { matched: false, poolsConsidered: pools.length, reason: lastReason };
}

export async function listMyRides(passengerId: string, limit: number) {
  const rides = await prisma.rideRequest.findMany({
    where: { passengerId },
    include: PASSENGER_RIDE_INCLUDE,
    orderBy: { requestedAt: 'desc' },
    take: limit,
  });
  return rides.map((r) => passengerRideView(r));
}

const SEARCH_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export async function getCurrentRide(passengerId: string) {
  const ride = await prisma.rideRequest.findFirst({
    where: { passengerId, status: { in: [...ACTIVE_RIDE_STATUSES] } },
    include: PASSENGER_RIDE_DETAIL_INCLUDE,
  });
  if (!ride) return null;

  if (ride.status === 'REQUESTED' && Date.now() - ride.requestedAt.getTime() > SEARCH_TIMEOUT_MS) {
    await cancelRide(passengerId, ride.id, 'No driver found within 2 minutes — please try again');
    return null;
  }

  return passengerRideDetailView(ride);
}

/** Scoped by passenger: someone else's ride id is indistinguishable from a missing one. */
export async function getMyRide(passengerId: string, rideId: string) {
  const ride = await prisma.rideRequest.findFirst({
    where: { id: rideId, passengerId },
    include: PASSENGER_RIDE_DETAIL_INCLUDE,
  });
  if (!ride) throw notFound('Ride not found');
  return passengerRideDetailView(ride);
}

export async function cancelRide(passengerId: string, rideId: string, reason?: string) {
  // Lock order is pool → ride. We learn the pool id before locking; if the ride
  // got matched in between, the ids disagree and we retry with the right lock.
  for (let attempt = 0; attempt < 3; attempt++) {
    const peek = await prisma.rideRequest.findFirst({
      where: { id: rideId, passengerId },
      select: { membership: { select: { poolId: true } } },
    });
    if (!peek) throw notFound('Ride not found');
    const poolId = peek.membership?.poolId ?? null;

    const done = await prisma.$transaction(async (tx) => {
      if (poolId) await lockPool(tx, poolId);
      await lockRide(tx, rideId);
      const ride = await tx.rideRequest.findUniqueOrThrow({ where: { id: rideId }, include: { membership: true } });
      if ((ride.membership?.poolId ?? null) !== poolId) return false;

      assertTransition(ride.status, 'CANCELLED', 'PASSENGER');
      const now = new Date();
      await tx.rideRequest.update({
        where: { id: rideId },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason || null },
      });
      if (ride.membership) {
        await tx.poolMembership.update({ where: { id: ride.membership.id }, data: { leftAt: now } });
      }
      await recordEvent(tx, {
        rideRequestId: rideId,
        poolId,
        from: ride.status,
        to: 'CANCELLED',
        actor: { type: 'PASSENGER', id: passengerId },
        note: reason ? `Cancelled: ${reason}` : 'Cancelled by passenger',
      });
      if (poolId) {
        await settlePool(tx, poolId); // frees the seats, maybe cancels an emptied pool
        await requoteMembers(tx, poolId); // remaining riders may lose the pool discount
      }
      return true;
    });

    if (done) return getMyRide(passengerId, rideId);
  }
  throw conflict('The ride changed while cancelling, please try again', 'RETRY');
}
