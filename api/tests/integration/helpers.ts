import request from 'supertest';
import { createApp } from '../../src/app';
import { seedGeography } from '../../src/db/seeders';
import { hashPassword } from '../../src/lib/password';
import { prisma } from '../../src/lib/prisma';
import { assertDisposable } from './global-setup';

export const app = createApp();
export const api = () => request(app);

export const FIXTURE_PASSWORD = 'test-password-123';

export const PASSENGERS = [
  { name: 'RiderA', phoneNumber: '01711000001', walletBalancePaisa: 50_000 },
  { name: 'RiderB', phoneNumber: '01711000002', walletBalancePaisa: 50_000 },
  // Only ৳40 in TeslaPay, for the insufficient-balance cases.
  { name: 'RiderC', phoneNumber: '01711000003', walletBalancePaisa: 4_000 },
] as const;

export const DRIVER = {
  name: 'DriverA',
  phoneNumber: '01811000001',
  licenseNumber: 'TEST-LICENSE-0001',
  startsOnlineAt: 'BANANI_RD_11',
  vehicle: { modelName: 'Tesla Model 3', plateNumber: 'TEST-PLATE-0001', capacity: 3 },
} as const;

/** Wipes every table, re-seeds zones and creates the test riders and driver. */
export async function resetDatabase() {
  assertDisposable(process.env.DATABASE_URL!);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE payments, ride_status_events, fare_calculations, pool_memberships,
      spatial_trajectories, ride_requests, pools, vehicles, drivers, passengers,
      sub_locations, locations
    RESTART IDENTITY CASCADE
  `);
  await seedGeography(prisma);

  const passwordHash = await hashPassword(FIXTURE_PASSWORD);
  await prisma.passenger.createMany({ data: PASSENGERS.map((p) => ({ ...p, passwordHash })) });
  const startAt = await prisma.subLocation.findUniqueOrThrow({ where: { code: DRIVER.startsOnlineAt } });
  await prisma.driver.create({
    data: {
      name: DRIVER.name,
      phoneNumber: DRIVER.phoneNumber,
      licenseNumber: DRIVER.licenseNumber,
      passwordHash,
      isOnline: true,
      currentSubLocationId: startAt.id,
      vehicle: { create: DRIVER.vehicle },
    },
  });
}

type FixtureName = (typeof PASSENGERS)[number]['name'] | typeof DRIVER.name;

const phoneOf = (name: FixtureName) =>
  name === DRIVER.name ? DRIVER.phoneNumber : PASSENGERS.find((p) => p.name === name)!.phoneNumber;

/** Logs a fixture account in and returns its bearer token. */
export async function login(name: FixtureName): Promise<string> {
  const path = name === DRIVER.name ? '/api/auth/drivers/login' : '/api/auth/passengers/login';
  const res = await api().post(path).send({ phoneNumber: phoneOf(name), password: FIXTURE_PASSWORD });
  if (res.status !== 200) throw new Error(`login ${name} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function subLocationId(code: string) {
  return (await prisma.subLocation.findUniqueOrThrow({ where: { code } })).id;
}
