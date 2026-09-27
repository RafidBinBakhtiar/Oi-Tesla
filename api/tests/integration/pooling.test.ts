import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { api, bearer, login, resetDatabase, subLocationId } from './helpers';

/**
 * The risky behaviour the brief asks us to prove, exercised through the real
 * HTTP API against Postgres: capacity, state transitions, pooled fares,
 * ownership, cancellation and the last-seat race.
 */

let riderA: string, riderB: string, riderC: string, driverA: string;
let BANANI: string, MOHAKHALI: string, GULSHAN_1: string;

beforeEach(async () => {
  await resetDatabase();
  [riderA, riderB, riderC, driverA] = await Promise.all([
    login('RiderA'),
    login('RiderB'),
    login('RiderC'),
    login('DriverA'),
  ]);
  [BANANI, MOHAKHALI, GULSHAN_1] = await Promise.all([
    subLocationId('BANANI_RD_11'),
    subLocationId('MOHAKHALI'),
    subLocationId('GULSHAN_1'),
  ]);
});

const requestRide = (token: string, dropoffId: string, extra: Record<string, unknown> = {}) =>
  api().post('/api/rides').set(bearer(token)).send({ pickupId: BANANI, dropoffId, ...extra });

const accept = (rideId: string) => api().post(`/api/driver/requests/${rideId}/accept`).set(bearer(driverA));
const advance = (rideId: string, step: 'arrive' | 'start' | 'complete') =>
  api().post(`/api/driver/rides/${rideId}/${step}`).set(bearer(driverA));
const myRide = (token: string, rideId: string) => api().get(`/api/rides/${rideId}`).set(bearer(token));

/** RiderA requests, DriverA accepts, RiderB is auto-pooled. Returns ride ids. */
async function riderAAndRiderBPooled() {
  const n = await requestRide(riderA, MOHAKHALI);
  expect((await accept(n.body.ride.id)).status).toBe(200);
  const r = await requestRide(riderB, GULSHAN_1);
  expect(r.body.ride.status).toBe('MATCHED');
  return { riderARide: n.body.ride.id as string, riderBRide: r.body.ride.id as string };
}

describe("pooled fares — RiderA and RiderB share the car", () => {
  it('quotes both riders the pooled price and freezes it as FINAL on drop-off', async () => {
    const n = await requestRide(riderA, MOHAKHALI);
    expect(n.body.ride.fare).toMatchObject({ kind: 'ESTIMATE', distanceM: 1789, finalFarePaisa: 6578 });

    await accept(n.body.ride.id);
    const r = await requestRide(riderB, GULSHAN_1);
    expect(r.body.autoMatch).toMatchObject({ matched: true });
    expect(r.body.ride.fare).toMatchObject({
      kind: 'QUOTE',
      distanceM: 1935,
      baseFarePaisa: 3000,
      distanceFarePaisa: 3870,
      poolDiscountPaisa: 967,
      finalFarePaisa: 5903,
    });

    const riderANow = await myRide(riderA, n.body.ride.id);
    expect(riderANow.body.fare).toMatchObject({ poolDiscountPaisa: 894, finalFarePaisa: 5684, isPooled: true });
    expect(riderANow.body.fareHistory.map((f: { finalFarePaisa: number }) => f.finalFarePaisa)).toEqual([6578, 6578, 5684]);

    for (const step of ['arrive', 'start', 'complete'] as const) await advance(n.body.ride.id, step);
    const done = await myRide(riderA, n.body.ride.id);
    expect(done.body.fare).toMatchObject({ kind: 'FINAL', finalFarePaisa: 5684 });
    expect(done.body.payment).toMatchObject({ method: 'CASH', amountPaisa: 5684 });
  });

  it('plans the route Banani Rd 11 → Mohakhali → Gulshan 1', async () => {
    await riderAAndRiderBPooled();
    const pool = (await api().get('/api/driver/pool/current').set(bearer(driverA))).body.pool;
    expect(pool.stops.map((s: { place: { name: string } }) => s.place.name)).toEqual([
      'Banani Road 11',
      'Mohakhali',
      'Gulshan 1',
    ]);
  });

  it('debits TeslaPay exactly the final fare', async () => {
    const n = await requestRide(riderA, MOHAKHALI, { paymentMethod: 'TESLAPAY' });
    await accept(n.body.ride.id);
    for (const step of ['arrive', 'start', 'complete'] as const) await advance(n.body.ride.id, step);
    const me = await api().get('/api/auth/me').set(bearer(riderA));
    expect(me.body.walletBalancePaisa).toBe(50_000 - 6578);
  });

  it('refuses TeslaPay when the wallet cannot cover the solo estimate', async () => {
    const res = await requestRide(riderC, GULSHAN_1, { paymentMethod: 'TESLAPAY' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_BALANCE', details: { balancePaisa: 4000, requiredPaisa: 6870 } });
  });
});

describe("a car's capacity can never be exceeded", () => {
  it('keeps a 2-seat request waiting when one seat is left, and lets a 1-seat request in', async () => {
    await riderAAndRiderBPooled();

    const twoSeats = await requestRide(riderC, MOHAKHALI, { seats: 2 });
    expect(twoSeats.body.ride.status).toBe('REQUESTED');
    expect(twoSeats.body.autoMatch.reason).toBe('Only 1 of 3 seats left, 2 requested');
    const forced = await accept(twoSeats.body.ride.id);
    expect(forced.status).toBe(409);
    expect(forced.body.error.code).toBe('NO_SEATS');

    await api().post(`/api/rides/${twoSeats.body.ride.id}/cancel`).set(bearer(riderC)).send({});
    const oneSeat = await requestRide(riderC, MOHAKHALI, { seats: 1 });
    expect(oneSeat.body.ride.status).toBe('MATCHED');
    expect(oneSeat.body.ride.pool).toMatchObject({ occupiedSeats: 3, capacity: 3, coRiderCount: 2 });
  });

  it('is enforced by the database even if application code is bypassed', async () => {
    await riderAAndRiderBPooled();
    const pool = await prisma.pool.findFirstOrThrow({ where: { status: 'OPEN' } });
    await expect(
      prisma.$executeRaw`UPDATE pools SET occupied_seats = capacity + 1 WHERE id = ${pool.id}::uuid`,
    ).rejects.toThrow(/pools_occupied_within_capacity/);
  });

  it('never opens a second active pool for the same Tesla', async () => {
    const pool = await riderAAndRiderBPooled();
    const current = await prisma.pool.findFirstOrThrow({ where: { status: 'OPEN' } });
    await expect(
      prisma.pool.create({
        data: {
          vehicleId: current.vehicleId,
          driverId: current.driverId,
          currentSubLocationId: current.currentSubLocationId,
          capacity: 3,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(pool).toBeTruthy();
  });
});

describe('two concurrent requests cannot corrupt pool capacity', () => {
  it('gives the last seat to exactly one of RiderA and RiderC', async () => {
    // RiderB travels with a friend: 2 of the car's 3 seats.
    const r = await requestRide(riderB, GULSHAN_1, { seats: 2 });
    await accept(r.body.ride.id);

    const [n, s] = await Promise.all([requestRide(riderA, MOHAKHALI), requestRide(riderC, MOHAKHALI)]);
    const statuses = [n.body.ride.status, s.body.ride.status].sort();
    expect(statuses).toEqual(['MATCHED', 'REQUESTED']);

    const pool = await prisma.pool.findFirstOrThrow({ where: { status: 'OPEN' }, include: { memberships: true } });
    expect(pool.occupiedSeats).toBe(3);
    expect(pool.memberships.reduce((sum, m) => sum + m.seats, 0)).toBe(3);
  });

  it('lets only one of two simultaneous accepts through for the same ride', async () => {
    const n = await requestRide(riderA, MOHAKHALI);
    const [a, b] = await Promise.all([accept(n.body.ride.id), accept(n.body.ride.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await prisma.pool.count()).toBe(1);
  });
});

describe('invalid state transitions are rejected', () => {
  it('cannot complete or start before the previous step', async () => {
    const { riderBRide } = await riderAAndRiderBPooled();
    const complete = await advance(riderBRide, 'complete');
    expect(complete.status).toBe(409);
    expect(complete.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'MATCHED', to: 'COMPLETED' } });
    expect((await advance(riderBRide, 'start')).status).toBe(409);
  });

  it('cannot move a completed ride again', async () => {
    const { riderARide } = await riderAAndRiderBPooled();
    for (const step of ['arrive', 'start', 'complete'] as const) expect((await advance(riderARide, step)).status).toBe(200);
    expect((await advance(riderARide, 'arrive')).status).toBe(409);
    expect((await advance(riderARide, 'complete')).status).toBe(409);
  });

  it('closes the pool to new riders once someone is on board', async () => {
    const { riderARide } = await riderAAndRiderBPooled();
    await advance(riderARide, 'arrive');
    await advance(riderARide, 'start');
    const late = await requestRide(riderC, MOHAKHALI);
    expect(late.body.ride.status).toBe('REQUESTED');
    const forced = await accept(late.body.ride.id);
    expect(forced.body.error.code).toBe('POOL_IN_PROGRESS');
  });

  it('completes the pool only after the last drop-off and moves DriverA there', async () => {
    const { riderARide, riderBRide } = await riderAAndRiderBPooled();
    for (const id of [riderARide, riderBRide]) {
      await advance(id, 'arrive');
      await advance(id, 'start');
    }
    const afterRiderA = await advance(riderARide, 'complete');
    expect(afterRiderA.body).toMatchObject({ status: 'IN_PROGRESS', occupiedSeats: 1 });
    const afterRiderB = await advance(riderBRide, 'complete');
    expect(afterRiderB.body).toMatchObject({ status: 'COMPLETED', occupiedSeats: 0 });
    const me = await api().get('/api/auth/me').set(bearer(driverA));
    expect(me.body.currentSubLocation.name).toBe('Gulshan 1');
  });
});

describe("users can't modify another user's ride", () => {
  it("hides RiderA's ride from RiderB and refuses his cancel", async () => {
    const n = await requestRide(riderA, MOHAKHALI);
    const rideId = n.body.ride.id;
    expect((await myRide(riderB, rideId)).status).toBe(404);
    expect((await api().post(`/api/rides/${rideId}/cancel`).set(bearer(riderB)).send({})).status).toBe(404);
    expect((await myRide(riderA, rideId)).body.status).toBe('REQUESTED');
  });

  it('never reveals co-riders to a passenger', async () => {
    const { riderBRide } = await riderAAndRiderBPooled();
    const body = JSON.stringify((await myRide(riderB, riderBRide)).body);
    expect(body).not.toContain('RiderA');
    expect(body).not.toContain('Mohakhali');
  });

  it('keeps passengers off driver endpoints and drivers off rides they do not drive', async () => {
    const n = await requestRide(riderA, MOHAKHALI);
    expect((await api().post(`/api/driver/requests/${n.body.ride.id}/accept`).set(bearer(riderA))).status).toBe(403);
    expect((await api().post('/api/rides').set(bearer(driverA)).send({})).status).toBe(403);
    // Not in any of DriverA's pools yet → looks missing.
    expect((await advance(n.body.ride.id, 'arrive')).status).toBe(404);
  });
});

describe('cancellation rules', () => {
  it('frees the seat and takes the pool discount back from the remaining rider', async () => {
    const { riderARide, riderBRide } = await riderAAndRiderBPooled();
    const cancel = await api().post(`/api/rides/${riderBRide}/cancel`).set(bearer(riderB)).send({ reason: 'Meeting moved' });
    expect(cancel.status).toBe(200);
    expect(cancel.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Meeting moved', canCancel: false });

    const n = await myRide(riderA, riderARide);
    expect(n.body.pool).toMatchObject({ occupiedSeats: 1, coRiderCount: 0 });
    expect(n.body.fare).toMatchObject({ isPooled: false, finalFarePaisa: 6578 });
  });

  it('allows cancelling after the driver arrived but not after pickup', async () => {
    const { riderARide, riderBRide } = await riderAAndRiderBPooled();
    await advance(riderBRide, 'arrive');
    expect((await api().post(`/api/rides/${riderBRide}/cancel`).set(bearer(riderB)).send({})).status).toBe(200);

    await advance(riderARide, 'arrive');
    await advance(riderARide, 'start');
    const late = await api().post(`/api/rides/${riderARide}/cancel`).set(bearer(riderA)).send({});
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('cancels an emptied pool so DriverA can take new riders or go offline', async () => {
    const n = await requestRide(riderA, MOHAKHALI);
    await accept(n.body.ride.id);
    const offlineWhileBusy = await api().patch('/api/driver/availability').set(bearer(driverA)).send({ online: false });
    expect(offlineWhileBusy.status).toBe(409);

    await api().post(`/api/rides/${n.body.ride.id}/cancel`).set(bearer(riderA)).send({});
    expect(await prisma.pool.findFirst({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })).toBeNull();
    expect((await api().patch('/api/driver/availability').set(bearer(driverA)).send({ online: false })).status).toBe(200);
  });

  it('allows only one active ride per passenger', async () => {
    await requestRide(riderA, MOHAKHALI);
    const second = await requestRide(riderA, GULSHAN_1);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
  });

  it('records every transition in the timeline', async () => {
    const { riderARide } = await riderAAndRiderBPooled();
    for (const step of ['arrive', 'start', 'complete'] as const) await advance(riderARide, step);
    const timeline = (await myRide(riderA, riderARide)).body.timeline.map(
      (t: { from: string | null; to: string; actor: string }) => `${t.from ?? '-'}>${t.to}:${t.actor}`,
    );
    expect(timeline).toEqual([
      '->REQUESTED:PASSENGER',
      'REQUESTED>MATCHED:DRIVER',
      'MATCHED>DRIVER_ARRIVED:DRIVER',
      'DRIVER_ARRIVED>STARTED:DRIVER',
      'STARTED>COMPLETED:DRIVER',
    ]);
  });
});
