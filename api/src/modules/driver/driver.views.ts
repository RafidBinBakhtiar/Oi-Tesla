import type { Prisma, RideStatus } from '@prisma/client';
import { POOL_INCLUDE, routePlanOf } from '../pools/pool.engine';
import { fareView } from '../rides/ride.views';

/** The driver sees who is riding (names, stops, fares to collect) — passengers do not. */
export const DRIVER_POOL_INCLUDE = {
  ...POOL_INCLUDE,
  memberships: {
    orderBy: { joinedAt: 'asc' },
    include: {
      rideRequest: {
        include: {
          pickup: true,
          dropoff: true,
          passenger: { select: { id: true, name: true } },
          fareCalculations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
          payment: true,
        },
      },
    },
  },
} satisfies Prisma.PoolInclude;

type DriverPool = Prisma.PoolGetPayload<{ include: typeof DRIVER_POOL_INCLUDE }>;

const NEXT_ACTION: Partial<Record<RideStatus, 'ARRIVE' | 'START' | 'COMPLETE'>> = {
  MATCHED: 'ARRIVE',
  DRIVER_ARRIVED: 'START',
  STARTED: 'COMPLETE',
};

export function driverPoolView(pool: DriverPool) {
  const plan = routePlanOf(pool);
  return {
    id: pool.id,
    status: pool.status,
    capacity: pool.capacity,
    occupiedSeats: pool.occupiedSeats,
    origin: { id: pool.currentSubLocation.id, name: pool.currentSubLocation.name },
    headingDeg: pool.trajectory?.routeHeadingDeg ?? null,
    vehicle: { modelName: pool.vehicle.modelName, plateNumber: pool.vehicle.plateNumber },
    createdAt: pool.createdAt,
    startedAt: pool.startedAt,
    completedAt: pool.completedAt,
    cancelledAt: pool.cancelledAt,
    riders: pool.memberships.map(({ rideRequest: r, joinedAt, leftAt }) => ({
      rideId: r.id,
      passengerName: r.passenger.name,
      seats: r.seatsRequested,
      status: r.status,
      pickup: { id: r.pickup.id, name: r.pickup.name },
      dropoff: { id: r.dropoff.id, name: r.dropoff.name },
      distanceM: r.distanceM,
      paymentMethod: r.paymentMethod,
      fare: r.fareCalculations[0] ? fareView(r.fareCalculations[0]) : null,
      payment: r.payment ? { method: r.payment.method, amountPaisa: r.payment.amountPaisa, note: r.payment.note } : null,
      nextAction: NEXT_ACTION[r.status] ?? null,
      joinedAt,
      leftAt,
    })),
    stops:
      plan?.stops.map((s) => ({ kind: s.kind, place: { id: s.place.id, name: s.place.name }, rideIds: s.rideIds })) ?? [],
    plannedDistanceM: plan?.totalDistanceM ?? 0,
  };
}
