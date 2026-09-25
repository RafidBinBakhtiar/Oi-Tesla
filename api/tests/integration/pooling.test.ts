import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { api, bearer, login, resetDatabase, subLocationId } from './helpers';

/**
 * The risky behaviour the brief asks us to prove, exercised through the real
 * HTTP API against Postgres: capacity, state transitions, pooled fares,
 * ownership, cancellation and the last-seat race.
 */

let nusrat: string, rafiq: string, shirin: string, jashim: string;
let BANANI: string, MOHAKHALI: string, GULSHAN_1: string;

beforeEach(async () => {
  await resetDatabase();
  [nusrat, rafiq, shirin, jashim] = await Promise.all([
    login('Nusrat'),
    login('Rafiq'),
    login('Shirin'),
    login('Jashim'),
  ]);
  [BANANI, MOHAKHALI, GULSHAN_1] = await Promise.all([
    subLocationId('BANANI_RD_11'),
    subLocationId('MOHAKHALI'),
    subLocationId('GULSHAN_1'),
  ]);
});

const requestRide = (token: string, dropoffId: string, extra: Record<string, unknown> = {}) =>
  api().post('/api/rides').set(bearer(token)).send({ pickupId: BANANI, dropoffId, ...extra });

const accept = (rideId: string) => api().post(`/api/driver/requests/${rideId}/accept`).set(bearer(jashim));
const advance = (rideId: string, step: 'arrive' | 'start' | 'complete') =>
  api().post(`/api/driver/rides/${rideId}/${step}`).set(bearer(jashim));
const myRide = (token: string, rideId: string) => api().get(`/api/rides/${rideId}`).set(bearer(token));

/** Nusrat requests, Jashim accepts, Rafiq is auto-pooled. Returns ride ids. */
async function nusratAndRafiqPooled() {
  const n = await requestRide(nusrat, MOHAKHALI);
  expect((await accept(n.body.ride.id)).status).toBe(200);
  const r = await requestRide(rafiq, GULSHAN_1);
  expect(r.body.ride.status).toBe('MATCHED');
  return { nusratRide: n.body.ride.id as string, rafiqRide: r.body.ride.id as string };
}

describe("pooled fares — Nusrat and Rafiq share Bullet", () => {
  it('quotes both riders the pooled price and freezes it as FINAL on drop-off', async () => {
    const n = await requestRide(nusrat, MOHAKHALI);
    expect(n.body.ride.fare).toMatchObject({ kind: 'ESTIMATE', distanceM: 1789, finalFarePaisa: 6578 });

    await accept(n.body.ride.id);
    const r = await requestRide(rafiq, GULSHAN_1);
    expect(r.body.autoMatch).toMatchObject({ matched: true });
    expect(r.body.ride.fare).toMatchObject({
      kind: 'QUOTE',
      distanceM: 1935,
      baseFarePaisa: 3000,
      distanceFarePaisa: 3870,
      poolDiscountPaisa: 967,
      finalFarePaisa: 5903,
    });

    const nusratNow = await myRide(nusrat, n.body.ride.id);
    expect(nusratNow.body.fare).toMatchObject({ poolDiscountPaisa: 894, finalFarePaisa: 5684, isPooled: true });
    expect(nusratNow.body.fareHistory.map((f: { finalFarePaisa: number }) => f.finalFarePaisa)).toEqual([6578, 6578, 5684]);

    for (const step of ['arrive', 'start', 'complete'] as const) await advance(n.body.ride.id, step);
    const done = await myRide(nusrat, n.body.ride.id);
    expect(done.body.fare).toMatchObject({ kind: 'FINAL', finalFarePaisa: 5684 });
    expect(done.body.payment).toMatchObject({ method: 'CASH', amountPaisa: 5684 });
  });

  it('plans the route Banani Rd 11 → Mohakhali → Gulshan 1', async () => {
    await nusratAndRafiqPooled();
    const pool = (await api().get('/api/driver/pool/current').set(bearer(jashim))).body.pool;
    expect(pool.stops.map((s: { place: { name: string } }) => s.place.name)).toEqual([
      'Banani Road 11',
      'Mohakhali',
      'Gulshan 1',
    ]);
  });

  it('debits TeslaPay exactly the final fare', async () => {
    const n = await requestRide(nusrat, MOHAKHALI, { paymentMethod: 'TESLAPAY' });
    await accept(n.body.ride.id);
    for (const step of ['arrive', 'start', 'complete'] as const) await advance(n.body.ride.id, step);
    const me = await api().get('/api/auth/me').set(bearer(nusrat));
    expect(me.body.walletBalancePaisa).toBe(50_000 - 6578);
  });

  it('refuses TeslaPay when the wallet cannot cover the solo estimate', async () => {
    const res = await requestRide(shirin, GULSHAN_1, { paymentMethod: 'TESLAPAY' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_BALANCE', details: { balancePaisa: 4000, requiredPaisa: 6870 } });
  });
});

describe("Bullet's capacity can never be exceeded", () => {
  it('keeps a 2-seat request waiting when one seat is left, and lets a 1-seat request in', async () => {
    await nusratAndRafiqPooled();

    const twoSeats = await requestRide(shirin, MOHAKHALI, { seats: 2 });
    expect(twoSeats.body.ride.status).toBe('REQUESTED');
    expect(twoSeats.body.autoMatch.reason).toBe('Only 1 of 3 seats left, 2 requested');
    const forced = await accept(twoSeats.body.ride.id);
    expect(forced.status).toBe(409);
    expect(forced.body.error.code).toBe('NO_SEATS');

    await api().post(`/api/rides/${twoSeats.body.ride.id}/cancel`).set(bearer(shirin)).send({});
    const oneSeat = await requestRide(shirin, MOHAKHALI, { seats: 1 });
    expect(oneSeat.body.ride.status).toBe('MATCHED');
    expect(oneSeat.body.ride.pool).toMatchObject({ occupiedSeats: 3, capacity: 3, coRiderCount: 2 });
  });

  it('is enforced by the database even if application code is bypassed', async () => {
    await nusratAndRafiqPooled();
    const pool = await prisma.pool.findFirstOrThrow({ where: { status: 'OPEN' } });
    await expect(
      prisma.$executeRaw`UPDATE pools SET occupied_seats = capacity + 1 WHERE id = ${pool.id}::uuid`,
    ).rejects.toThrow(/pools_occupied_within_capacity/);
  });

  it('never opens a second active pool for the same Tesla', async () => {
    const pool = await nusratAndRafiqPooled();
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
  it('gives the last seat to exactly one of Nusrat and Shirin', async () => {
    // Rafiq travels with a friend: 2 of Bullet's 3 seats.
    const r = await requestRide(rafiq, GULSHAN_1, { seats: 2 });
    await accept(r.body.ride.id);

    const [n, s] = await Promise.all([requestRide(nusrat, MOHAKHALI), requestRide(shirin, MOHAKHALI)]);
    const statuses = [n.body.ride.status, s.body.ride.status].sort();
    expect(statuses).toEqual(['MATCHED', 'REQUESTED']);

    const pool = await prisma.pool.findFirstOrThrow({ where: { status: 'OPEN' }, include: { memberships: true } });
    expect(pool.occupiedSeats).toBe(3);
    expect(pool.memberships.reduce((sum, m) => sum + m.seats, 0)).toBe(3);
  });

  it('lets only one of two simultaneous accepts through for the same ride', async () => {
    const n = await requestRide(nusrat, MOHAKHALI);
    const [a, b] = await Promise.all([accept(n.body.ride.id), accept(n.body.ride.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await prisma.pool.count()).toBe(1);
  });
});

describe('invalid state transitions are rejected', () => {
  it('cannot complete or start before the previous step', async () => {
    const { rafiqRide } = await nusratAndRafiqPooled();
    const complete = await advance(rafiqRide, 'complete');
    expect(complete.status).toBe(409);
    expect(complete.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'MATCHED', to: 'COMPLETED' } });
    expect((await advance(rafiqRide, 'start')).status).toBe(409);
  });

  it('cannot move a completed ride again', async () => {
    const { nusratRide } = await nusratAndRafiqPooled();
    for (const step of ['arrive', 'start', 'complete'] as const) expect((await advance(nusratRide, step)).status).toBe(200);
    expect((await advance(nusratRide, 'arrive')).status).toBe(409);
    expect((await advance(nusratRide, 'complete')).status).toBe(409);
  });

  it('closes the pool to new riders once someone is on board', async () => {
    const { nusratRide } = await nusratAndRafiqPooled();
    await advance(nusratRide, 'arrive');
    await advance(nusratRide, 'start');
    const late = await requestRide(shirin, MOHAKHALI);
    expect(late.body.ride.status).toBe('REQUESTED');
    const forced = await accept(late.body.ride.id);
    expect(forced.body.error.code).toBe('POOL_IN_PROGRESS');
  });

  it('completes the pool only after the last drop-off and moves Jashim there', async () => {
    const { nusratRide, rafiqRide } = await nusratAndRafiqPooled();
    for (const id of [nusratRide, rafiqRide]) {
      await advance(id, 'arrive');
      await advance(id, 'start');
    }
    const afterNusrat = await advance(nusratRide, 'complete');
    expect(afterNusrat.body).toMatchObject({ status: 'IN_PROGRESS', occupiedSeats: 1 });
    const afterRafiq = await advance(rafiqRide, 'complete');
    expect(afterRafiq.body).toMatchObject({ status: 'COMPLETED', occupiedSeats: 0 });
    const me = await api().get('/api/auth/me').set(bearer(jashim));
    expect(me.body.currentSubLocation.name).toBe('Gulshan 1');
  });
});

describe("users can't modify another user's ride", () => {
  it("hides Nusrat's ride from Rafiq and refuses his cancel", async () => {
    const n = await requestRide(nusrat, MOHAKHALI);
    const rideId = n.body.ride.id;
    expect((await myRide(rafiq, rideId)).status).toBe(404);
    expect((await api().post(`/api/rides/${rideId}/cancel`).set(bearer(rafiq)).send({})).status).toBe(404);
    expect((await myRide(nusrat, rideId)).body.status).toBe('REQUESTED');
  });

  it('never reveals co-riders to a passenger', async () => {
    const { rafiqRide } = await nusratAndRafiqPooled();
    const body = JSON.stringify((await myRide(rafiq, rafiqRide)).body);
    expect(body).not.toContain('Nusrat');
    expect(body).not.toContain('Mohakhali');
  });

  it('keeps passengers off driver endpoints and drivers off rides they do not drive', async () => {
    const n = await requestRide(nusrat, MOHAKHALI);
    expect((await api().post(`/api/driver/requests/${n.body.ride.id}/accept`).set(bearer(nusrat))).status).toBe(403);
    expect((await api().post('/api/rides').set(bearer(jashim)).send({})).status).toBe(403);
    // Not in any of Jashim's pools yet → looks missing.
    expect((await advance(n.body.ride.id, 'arrive')).status).toBe(404);
  });
});

describe('cancellation rules', () => {
  it('frees the seat and takes the pool discount back from the remaining rider', async () => {
    const { nusratRide, rafiqRide } = await nusratAndRafiqPooled();
    const cancel = await api().post(`/api/rides/${rafiqRide}/cancel`).set(bearer(rafiq)).send({ reason: 'Meeting moved' });
    expect(cancel.status).toBe(200);
    expect(cancel.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Meeting moved', canCancel: false });

    const n = await myRide(nusrat, nusratRide);
    expect(n.body.pool).toMatchObject({ occupiedSeats: 1, coRiderCount: 0 });
    expect(n.body.fare).toMatchObject({ isPooled: false, finalFarePaisa: 6578 });
  });

  it('allows cancelling after the driver arrived but not after pickup', async () => {
    const { nusratRide, rafiqRide } = await nusratAndRafiqPooled();
    await advance(rafiqRide, 'arrive');
    expect((await api().post(`/api/rides/${rafiqRide}/cancel`).set(bearer(rafiq)).send({})).status).toBe(200);

    await advance(nusratRide, 'arrive');
    await advance(nusratRide, 'start');
    const late = await api().post(`/api/rides/${nusratRide}/cancel`).set(bearer(nusrat)).send({});
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('cancels an emptied pool so Jashim can take new riders or go offline', async () => {
    const n = await requestRide(nusrat, MOHAKHALI);
    await accept(n.body.ride.id);
    const offlineWhileBusy = await api().patch('/api/driver/availability').set(bearer(jashim)).send({ online: false });
    expect(offlineWhileBusy.status).toBe(409);

    await api().post(`/api/rides/${n.body.ride.id}/cancel`).set(bearer(nusrat)).send({});
    expect(await prisma.pool.findFirst({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })).toBeNull();
    expect((await api().patch('/api/driver/availability').set(bearer(jashim)).send({ online: false })).status).toBe(200);
  });

  it('allows only one active ride per passenger', async () => {
    await requestRide(nusrat, MOHAKHALI);
    const second = await requestRide(nusrat, GULSHAN_1);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
  });

  it('records every transition in the timeline', async () => {
    const { nusratRide } = await nusratAndRafiqPooled();
    for (const step of ['arrive', 'start', 'complete'] as const) await advance(nusratRide, step);
    const timeline = (await myRide(nusrat, nusratRide)).body.timeline.map(
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
