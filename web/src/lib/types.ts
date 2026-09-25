// Shapes returned by the Oi Tesla API (see api/src/modules/*/*.views.ts).

export type Role = 'passenger' | 'driver';
export type RideStatus = 'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type PoolStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'TESLAPAY';

export interface PassengerUser {
  id: string;
  role: 'passenger';
  name: string;
  phoneNumber: string;
  walletBalancePaisa: number;
}

export interface DriverUser {
  id: string;
  role: 'driver';
  name: string;
  phoneNumber: string;
  licenseNumber: string;
  isOnline: boolean;
  currentSubLocation: { id: string; name: string } | null;
  vehicle: { id: string; modelName: string; plateNumber: string; capacity: number } | null;
}

export type User = PassengerUser | DriverUser;

export interface Zone {
  id: string;
  code: string;
  name: string;
  subLocations: { id: string; code: string; name: string; lat: number; lng: number }[];
}

export interface Named {
  id: string;
  name: string;
}

export interface Fare {
  kind?: 'ESTIMATE' | 'QUOTE' | 'FINAL';
  distanceM: number;
  seats: number;
  baseFarePaisa: number;
  distanceFarePaisa: number;
  poolDiscountPaisa: number;
  finalFarePaisa: number;
  isPooled: boolean;
  coRiderCount: number;
  calculatedAt?: string;
}

export interface Estimate {
  pickup: Named;
  dropoff: Named;
  distanceM: number;
  soloDurationSeconds: number;
  solo: Fare;
  pooled: Fare;
}

export interface Payment {
  method: PaymentMethod;
  amountPaisa: number;
  note: string | null;
}

export interface Ride {
  id: string;
  status: RideStatus;
  seats: number;
  distanceM: number;
  paymentMethod: PaymentMethod;
  pickup: Named;
  dropoff: Named;
  requestedAt: string;
  matchedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  fare: Fare | null;
  payment: Payment | null;
  pool: {
    id: string;
    status: PoolStatus;
    occupiedSeats: number;
    capacity: number;
    coRiderCount: number;
    vehicle: { modelName: string; plateNumber: string };
    driver: { name: string; phoneNumber: string };
  } | null;
}

export interface TimelineEntry {
  from: RideStatus | null;
  to: RideStatus;
  actor: 'PASSENGER' | 'DRIVER' | 'SYSTEM';
  note: string | null;
  at: string;
}

export interface RideDetail extends Ride {
  fareHistory: Fare[];
  timeline: TimelineEntry[];
}

export interface CreateRideResponse {
  ride: RideDetail;
  autoMatch: { matched: boolean; poolsConsidered: number; reason: string | null };
}

export interface PoolRider {
  rideId: string;
  passengerName: string;
  seats: number;
  status: RideStatus;
  pickup: Named;
  dropoff: Named;
  distanceM: number;
  paymentMethod: PaymentMethod;
  fare: Fare | null;
  payment: Payment | null;
  nextAction: 'ARRIVE' | 'START' | 'COMPLETE' | null;
  joinedAt: string;
  leftAt: string | null;
}

export interface DriverPool {
  id: string;
  status: PoolStatus;
  capacity: number;
  occupiedSeats: number;
  origin: Named;
  headingDeg: number | null;
  vehicle: { modelName: string; plateNumber: string };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  riders: PoolRider[];
  stops: { kind: 'PICKUP' | 'DROPOFF'; place: Named; rideIds: string[] }[];
  plannedDistanceM: number;
}

export interface RelevantRequest {
  rideId: string;
  passengerName: string;
  seats: number;
  pickup: Named;
  dropoff: Named;
  distanceM: number;
  requestedAt: string;
  soloFarePaisa: number;
  pooledFarePaisa: number;
  canAccept: boolean;
  reason: string | null;
}

export interface RelevantRequests {
  online: boolean;
  zone: Named | null;
  requests: RelevantRequest[];
}
