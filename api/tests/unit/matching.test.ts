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

const nusrat = leg('nusrat', 'BANANI_RD_11', 'MOHAKHALI');
const rafiq = leg('rafiq', 'BANANI_RD_11', 'GULSHAN_1');
const shirin = leg('shirin', 'BANANI_RD_11', 'MOHAKHALI');

/** Bullet after Jashim accepted Nusrat. */
const bulletWith = (members: RiderLeg[], overrides: Partial<PoolSnapshot> = {}): PoolSnapshot => ({
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

describe('matching — the Banani rush-hour story', () => {
  it('pools Rafiq with Nusrat and drops Nusrat at Mohakhali first', () => {
    const result = evaluateJoin(bulletWith([nusrat]), rafiq);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.stops.map((s) => `${s.kind}:${s.place.id}`)).toEqual([
      'PICKUP:BANANI_RD_11',
      'DROPOFF:MOHAKHALI',
      'DROPOFF:GULSHAN_1',
    ]);
    const detour = Object.fromEntries(result.plan.detours.map((d) => [d.rideId, d.extraSeconds]));
    expect(detour).toEqual({ nusrat: 0, rafiq: 275 });
    expect(result.plan.totalDistanceM).toBe(1789 + 1675);
  });

  it('gives Shirin the last seat when she asks for one', () => {
    const result = evaluateJoin(bulletWith([nusrat, rafiq]), shirin);
    expect(result.ok).toBe(true);
  });

  it('keeps Shirin waiting when she asks for two seats and only one is left', () => {
    const result = evaluateJoin(bulletWith([nusrat, rafiq]), { ...shirin, seats: 2 });
    expect(result).toMatchObject({ ok: false, code: 'NO_SEATS' });
    if (!result.ok) expect(result.reason).toBe('Only 1 of 3 seats left, 2 requested');
  });

  it('never fills beyond capacity, whatever the geometry', () => {
    const full = bulletWith([nusrat, rafiq, shirin]);
    expect(evaluateJoin(full, leg('tania', 'BANANI_RD_11', 'MOHAKHALI'))).toMatchObject({ code: 'NO_SEATS' });
  });

  it('rejects a rider going the opposite way', () => {
    // Banani → Baridhara heads north-east; Bullet is heading south to Mohakhali.
    const result = evaluateJoin(bulletWith([nusrat]), leg('x', 'BANANI_RD_11', 'BARIDHARA'));
    expect(result).toMatchObject({ ok: false, code: 'HEADING_MISMATCH' });
  });

  it('rejects a pickup in another zone', () => {
    const result = evaluateJoin(bulletWith([nusrat]), leg('x', 'DHANMONDI_27', 'FARMGATE'));
    expect(result).toMatchObject({ ok: false, code: 'DIFFERENT_CLUSTER' });
  });

  it('rejects a same-direction rider whose trip would delay someone too long', () => {
    // Heading passes (Farmgate is roughly on the way) but Rafiq would be dragged
    // far past Mohakhali before Gulshan 1.
    const result = evaluateJoin(bulletWith([nusrat, rafiq]), leg('x', 'BANANI_RD_11', 'FARMGATE'));
    expect(result).toMatchObject({ ok: false, code: 'DETOUR_TOO_LONG' });
  });

  it('refuses to add riders once anyone is on board', () => {
    const result = evaluateJoin(bulletWith([nusrat], { status: 'IN_PROGRESS' }), rafiq);
    expect(result).toMatchObject({ ok: false, code: 'POOL_CLOSED' });
  });

  it('refuses when the driver is offline', () => {
    const result = evaluateJoin(bulletWith([nusrat], { driverOnline: false }), rafiq);
    expect(result).toMatchObject({ ok: false, code: 'DRIVER_OFFLINE' });
  });
});

describe('route planner', () => {
  it('returns null when no drop-off order satisfies everyone', () => {
    // With a 4-minute cap, whichever of Nusrat/Rafiq is dropped second is delayed too much.
    expect(planRoute(place('BANANI_RD_11'), [nusrat, rafiq], 240)).toBeNull();
  });

  it('merges riders going to the same place into one stop', () => {
    const plan = planRoute(place('BANANI_RD_11'), [nusrat, shirin], 300)!;
    expect(plan.stops).toHaveLength(2);
    expect(plan.stops[1]!.rideIds).toEqual(['nusrat', 'shirin']);
  });

  it('visits the origin pickup first, then other pickups nearest-first', () => {
    const fromRd27 = leg('y', 'BANANI_RD_27', 'MOHAKHALI');
    const plan = planRoute(place('BANANI_RD_11'), [fromRd27, nusrat], 300)!;
    expect(plan.stops.map((s) => s.place.id)).toEqual(['BANANI_RD_11', 'BANANI_RD_27', 'MOHAKHALI']);
  });
});
