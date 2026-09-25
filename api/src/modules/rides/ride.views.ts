import type { FareCalculation, Prisma } from '@prisma/client';
import { isCancellable } from '../../domain/rideStateMachine';

/**
 * What a passenger may see about their own ride. Co-riders appear only as a
 * count — never their names, destinations or fares.
 */
export const PASSENGER_RIDE_INCLUDE = {
  pickup: true,
  dropoff: true,
  payment: true,
  fareCalculations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
  membership: {
    include: {
      pool: {
        include: {
          vehicle: true,
          driver: { select: { name: true, phoneNumber: true } },
          memberships: { select: { rideRequestId: true, rideRequest: { select: { status: true } } } },
        },
      },
    },
  },
} satisfies Prisma.RideRequestInclude;

export const PASSENGER_RIDE_DETAIL_INCLUDE = {
  ...PASSENGER_RIDE_INCLUDE,
  fareCalculations: { orderBy: { calculatedAt: 'asc' } },
  statusEvents: { orderBy: { id: 'asc' } },
} satisfies Prisma.RideRequestInclude;

type RideForView = Prisma.RideRequestGetPayload<{ include: typeof PASSENGER_RIDE_INCLUDE }>;
type RideForDetail = Prisma.RideRequestGetPayload<{ include: typeof PASSENGER_RIDE_DETAIL_INCLUDE }>;

export const fareView = (f: FareCalculation) => ({
  kind: f.kind,
  distanceM: f.distanceM,
  seats: f.seats,
  baseFarePaisa: f.baseFarePaisa,
  distanceFarePaisa: f.distanceFarePaisa,
  poolDiscountPaisa: f.poolDiscountPaisa,
  finalFarePaisa: f.finalFarePaisa,
  isPooled: f.isPooled,
  coRiderCount: f.coRiderCount,
  calculatedAt: f.calculatedAt,
});

export function passengerRideView(ride: RideForView, currentFare: FareCalculation | undefined = ride.fareCalculations[0]) {
  const pool = ride.membership?.pool;
  return {
    id: ride.id,
    status: ride.status,
    seats: ride.seatsRequested,
    distanceM: ride.distanceM,
    paymentMethod: ride.paymentMethod,
    pickup: { id: ride.pickup.id, name: ride.pickup.name },
    dropoff: { id: ride.dropoff.id, name: ride.dropoff.name },
    requestedAt: ride.requestedAt,
    matchedAt: ride.matchedAt,
    arrivedAt: ride.arrivedAt,
    startedAt: ride.startedAt,
    completedAt: ride.completedAt,
    cancelledAt: ride.cancelledAt,
    cancelReason: ride.cancelReason,
    canCancel: isCancellable(ride.status),
    fare: currentFare ? fareView(currentFare) : null,
    payment: ride.payment
      ? { method: ride.payment.method, amountPaisa: ride.payment.amountPaisa, note: ride.payment.note }
      : null,
    pool: pool
      ? {
          id: pool.id,
          status: pool.status,
          occupiedSeats: pool.occupiedSeats,
          capacity: pool.capacity,
          coRiderCount: pool.memberships.filter(
            (m) => m.rideRequestId !== ride.id && m.rideRequest.status !== 'CANCELLED',
          ).length,
          vehicle: { modelName: pool.vehicle.modelName, plateNumber: pool.vehicle.plateNumber },
          driver: { name: pool.driver.name, phoneNumber: pool.driver.phoneNumber },
        }
      : null,
  };
}

export function passengerRideDetailView(ride: RideForDetail) {
  return {
    ...passengerRideView(ride, ride.fareCalculations[ride.fareCalculations.length - 1]),
    fareHistory: ride.fareCalculations.map(fareView),
    timeline: ride.statusEvents.map((e) => ({
      from: e.fromStatus,
      to: e.toStatus,
      actor: e.actorType,
      note: e.note,
      at: e.createdAt,
    })),
  };
}
