import { describe, expect, it } from 'vitest';
import { calculateFare, estimateFare } from '../../src/domain/fare';

describe('fare model — RiderA and RiderB by hand', () => {
  it('RiderA, Banani Rd 11 → Mohakhali (1 789 m), alone: 3000 + 3578 = 6578', () => {
    expect(calculateFare({ distanceM: 1789, seats: 1, coRiderCount: 0 })).toEqual({
      distanceM: 1789,
      seats: 1,
      baseFarePaisa: 3000,
      distanceFarePaisa: 3578,
      poolDiscountPaisa: 0,
      finalFarePaisa: 6578,
      isPooled: false,
      coRiderCount: 0,
    });
  });

  it('RiderA pooled with RiderB: discount floor(3578 × 25%) = 894 → 5684', () => {
    const fare = calculateFare({ distanceM: 1789, seats: 1, coRiderCount: 1 });
    expect(fare.poolDiscountPaisa).toBe(894);
    expect(fare.finalFarePaisa).toBe(5684);
    expect(fare.isPooled).toBe(true);
  });

  it('RiderB, Banani Rd 11 → Gulshan 1 (1 935 m): 6870 alone, 5903 pooled', () => {
    expect(calculateFare({ distanceM: 1935, seats: 1, coRiderCount: 0 }).finalFarePaisa).toBe(6870);
    const pooled = calculateFare({ distanceM: 1935, seats: 1, coRiderCount: 1 });
    expect(pooled.distanceFarePaisa).toBe(3870);
    expect(pooled.poolDiscountPaisa).toBe(967); // floor(967.5)
    expect(pooled.finalFarePaisa).toBe(5903);
  });

  it('pays for your own distance only: pooling never raises a fare', () => {
    for (const distanceM of [1, 250, 1789, 1935, 12_345]) {
      const { solo, pooled } = estimateFare(distanceM, 1);
      expect(pooled.finalFarePaisa).toBeLessThanOrEqual(solo.finalFarePaisa);
    }
  });

  it('charges distance per seat, base fare once', () => {
    const twoSeats = calculateFare({ distanceM: 1789, seats: 2, coRiderCount: 0 });
    expect(twoSeats.baseFarePaisa).toBe(3000);
    expect(twoSeats.distanceFarePaisa).toBe(7156);
    expect(twoSeats.finalFarePaisa).toBe(10_156);
  });

  it('keeps the same discount no matter how many co-riders there are', () => {
    const withOne = calculateFare({ distanceM: 1789, seats: 1, coRiderCount: 1 });
    const withTwo = calculateFare({ distanceM: 1789, seats: 1, coRiderCount: 2 });
    expect(withTwo.finalFarePaisa).toBe(withOne.finalFarePaisa);
  });

  it('always adds up and stays integer', () => {
    for (const distanceM of [1, 3, 777, 1789, 99_999]) {
      for (const seats of [1, 2, 3]) {
        for (const coRiderCount of [0, 1, 2]) {
          const f = calculateFare({ distanceM, seats, coRiderCount });
          expect(f.finalFarePaisa).toBe(f.baseFarePaisa + f.distanceFarePaisa - f.poolDiscountPaisa);
          expect(Number.isInteger(f.finalFarePaisa)).toBe(true);
        }
      }
    }
  });

  it('rejects nonsense input', () => {
    expect(() => calculateFare({ distanceM: 0, seats: 1, coRiderCount: 0 })).toThrow(RangeError);
    expect(() => calculateFare({ distanceM: 12.5, seats: 1, coRiderCount: 0 })).toThrow(RangeError);
    expect(() => calculateFare({ distanceM: 100, seats: 0, coRiderCount: 0 })).toThrow(RangeError);
    expect(() => calculateFare({ distanceM: 100, seats: 1, coRiderCount: -1 })).toThrow(RangeError);
  });
});
