import request from 'supertest';
import { createApp } from '../../src/app';
import { DEMO_PASSWORD, DRIVERS, PASSENGERS } from '../../src/db/seedData';
import { seedGeography, seedPeople } from '../../src/db/seeders';
import { prisma } from '../../src/lib/prisma';
import { assertDisposable } from './global-setup';

export const app = createApp();
export const api = () => request(app);

/** Wipes every table and re-seeds zones + the story cast. */
export async function resetDatabase() {
  assertDisposable(process.env.DATABASE_URL!);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE payments, ride_status_events, fare_calculations, pool_memberships,
      spatial_trajectories, ride_requests, pools, vehicles, drivers, passengers,
      sub_locations, locations
    RESTART IDENTITY CASCADE
  `);
  await seedGeography(prisma);
  await seedPeople(prisma);
}

type CastName = 'Nusrat' | 'Rafiq' | 'Shirin' | 'Jashim';

const phoneOf = (name: CastName) =>
  [...PASSENGERS, ...DRIVERS].find((p) => p.name === name)!.phoneNumber;

/** Logs a cast member in and returns their bearer token. */
export async function login(name: CastName): Promise<string> {
  const path = name === 'Jashim' ? '/api/auth/drivers/login' : '/api/auth/passengers/login';
  const res = await api().post(path).send({ phoneNumber: phoneOf(name), password: DEMO_PASSWORD });
  if (res.status !== 200) throw new Error(`login ${name} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function subLocationId(code: string) {
  return (await prisma.subLocation.findUniqueOrThrow({ where: { code } })).id;
}
