import { RULES } from './rules';

export interface FareInput {
  distanceM: number;
  seats: number;
  /** Other ride requests sharing the pool (0 = riding alone). */
  coRiderCount: number;
}

export interface FareBreakdown {
  distanceM: number;
  seats: number;
  baseFarePaisa: number;
  distanceFarePaisa: number;
  poolDiscountPaisa: number;
  finalFarePaisa: number;
  isPooled: boolean;
  coRiderCount: number;
}

/**
 *   passengerFare = baseFare + distanceCharge − poolDiscount
 *
 *   baseFare       = 3 000 paisa
 *   distanceCharge = distance_m × 2 × seats
 *   poolDiscount   = floor(distanceCharge × 25 / 100)   when coRiderCount ≥ 1
 *
 * Pure integer arithmetic on paisa — no floats ever touch money.
 */
export function calculateFare({ distanceM, seats, coRiderCount }: FareInput): FareBreakdown {
  if (!Number.isInteger(distanceM) || distanceM <= 0) throw new RangeError('distanceM must be a positive integer');
  if (!Number.isInteger(seats) || seats < 1) throw new RangeError('seats must be a positive integer');
  if (!Number.isInteger(coRiderCount) || coRiderCount < 0) throw new RangeError('coRiderCount must be >= 0');

  const isPooled = coRiderCount > 0;
  const baseFarePaisa = RULES.BASE_FARE_PAISA;
  const distanceFarePaisa = distanceM * RULES.DISTANCE_PAISA_PER_METRE_PER_SEAT * seats;
  const poolDiscountPaisa = isPooled
    ? Math.floor((distanceFarePaisa * RULES.POOL_DISCOUNT_PERCENT) / 100)
    : 0;

  return {
    distanceM,
    seats,
    baseFarePaisa,
    distanceFarePaisa,
    poolDiscountPaisa,
    finalFarePaisa: baseFarePaisa + distanceFarePaisa - poolDiscountPaisa,
    isPooled,
    coRiderCount,
  };
}

/** Solo and pooled price side by side — what the passenger sees before booking. */
export function estimateFare(distanceM: number, seats: number) {
  return {
    solo: calculateFare({ distanceM, seats, coRiderCount: 0 }),
    pooled: calculateFare({ distanceM, seats, coRiderCount: 1 }),
  };
}

export const sameFare = (a: FareBreakdown, b: FareBreakdown) =>
  a.finalFarePaisa === b.finalFarePaisa &&
  a.poolDiscountPaisa === b.poolDiscountPaisa &&
  a.coRiderCount === b.coRiderCount;
