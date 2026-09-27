import { describe, expect, it } from 'vitest';
import { ZONES } from '../../src/db/seedData';
import {
  evaluateJoin,
  legHeadingDeg,
  type Place,
  planRoute,
  type PoolSnapshot,
  type RiderLeg,
} from '../../src/domain/matching';

const place = (code: string): Place => {
  for (const zone of ZONES) {
    const sub = zone.subLocations.find((s) => s.code === code);
    if (sub) return { id: code, name: sub.name, lat: sub.lat, lng: sub.lng, locationId: zone.code };
  }
  throw new Error(code);
};

const leg = (rideId: string, from: string, to: string, seats = 1): RiderLeg => ({
  rideId,
  seats,
  pickup: place(from),
  dropoff: place(to),
});

const riderA = leg('riderA', 'BANANI_RD_11', 'MOHAKHALI');
const riderB = leg('riderB', 'BANANI_RD_11', 'GULSHAN_1');
const riderC = leg('riderC', 'BANANI_RD_11', 'MOHAKHALI');

/** A 3-seat car after DriverA accepted RiderA. */
const carWith = (members: RiderLeg[], overrides: Partial<PoolSnapshot> = {}): PoolSnapshot => ({
  status: 'OPEN',
  driverOnline: true,
  capacity: 3,
  occupiedSeats: members.reduce((n, m) => n + m.seats, 0),
  origin: place('BANANI_RD_11'),
  headingDeg: legHeadingDeg(members[0]!),
  maxDetourSeconds: 300,
  members,
  ...overrides,
});

describe('matching — Banani rush hour', () => {
  it('pools RiderB with RiderA and drops RiderA at Mohakhali first', () => {
    const result = evaluateJoin(carWith([riderA]), riderB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.stops.map((s) => `${s.kind}:${s.place.id}`)).toEqual([
      'PICKUP:BANANI_RD_11',
      'DROPOFF:MOHAKHALI',
      'DROPOFF:GULSHAN_1',
    ]);
    const detour = Object.fromEntries(result.plan.detours.map((d) => [d.rideId, d.extraSeconds]));
    expect(detour).toEqual({ riderA: 0, riderB: 275 });
    expect(result.plan.totalDistanceM).toBe(1789 + 1675);
  });

  it('gives RiderC the last seat when she asks for one', () => {
    const result = evaluateJoin(carWith([riderA, riderB]), riderC);
    expect(result.ok).toBe(true);
  });

  it('keeps RiderC waiting when she asks for two seats and only one is left', () => {
    const result = evaluateJoin(carWith([riderA, riderB]), { ...riderC, seats: 2 });
    expect(result).toMatchObject({ ok: false, code: 'NO_SEATS' });
    if (!result.ok) expect(result.reason).toBe('Only 1 of 3 seats left, 2 requested');
  });

  it('never fills beyond capacity, whatever the geometry', () => {
    const full = carWith([riderA, riderB, riderC]);
    expect(evaluateJoin(full, leg('tania', 'BANANI_RD_11', 'MOHAKHALI'))).toMatchObject({
      code: 'NO_SEATS',
      reason: 'No seats left — all 3 are taken',
    });
  });

  it('rejects a rider going the opposite way', () => {
    // Banani → Baridhara heads north-east; the car is heading south to Mohakhali.
    const result = evaluateJoin(carWith([riderA]), leg('x', 'BANANI_RD_11', 'BARIDHARA'));
    expect(result).toMatchObject({ ok: false, code: 'HEADING_MISMATCH' });
  });

  it('rejects a pickup in another zone', () => {
    const result = evaluateJoin(carWith([riderA]), leg('x', 'DHANMONDI_27', 'FARMGATE'));
    expect(result).toMatchObject({ ok: false, code: 'DIFFERENT_CLUSTER' });
  });

  it('rejects a same-direction rider whose trip would delay someone too long', () => {
    // Heading passes (Farmgate is roughly on the way) but RiderB would be dragged
    // far past Mohakhali before Gulshan 1.
    const result = evaluateJoin(carWith([riderA, riderB]), leg('x', 'BANANI_RD_11', 'FARMGATE'));
    expect(result).toMatchObject({ ok: false, code: 'DETOUR_TOO_LONG' });
  });

  it('refuses to add riders once anyone is on board', () => {
    const result = evaluateJoin(carWith([riderA], { status: 'IN_PROGRESS' }), riderB);
    expect(result).toMatchObject({ ok: false, code: 'POOL_CLOSED' });
  });

  it('refuses when the driver is offline', () => {
    const result = evaluateJoin(carWith([riderA], { driverOnline: false }), riderB);
    expect(result).toMatchObject({ ok: false, code: 'DRIVER_OFFLINE' });
  });
});

describe('route planner', () => {
  it('returns null when no drop-off order satisfies everyone', () => {
    // With a 4-minute cap, whichever of RiderA/RiderB is dropped second is delayed too much.
    expect(planRoute(place('BANANI_RD_11'), [riderA, riderB], 240)).toBeNull();
  });

  it('merges riders going to the same place into one stop', () => {
    const plan = planRoute(place('BANANI_RD_11'), [riderA, riderC], 300)!;
    expect(plan.stops).toHaveLength(2);
    expect(plan.stops[1]!.rideIds).toEqual(['riderA', 'riderC']);
  });

  it('visits the origin pickup first, then other pickups nearest-first', () => {
    const fromRd27 = leg('y', 'BANANI_RD_27', 'MOHAKHALI');
    const plan = planRoute(place('BANANI_RD_11'), [fromRd27, riderA], 300)!;
    expect(plan.stops.map((s) => s.place.id)).toEqual(['BANANI_RD_11', 'BANANI_RD_27', 'MOHAKHALI']);
  });
});
