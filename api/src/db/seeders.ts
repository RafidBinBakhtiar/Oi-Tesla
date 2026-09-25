import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/password';
import { DEMO_PASSWORD, DRIVERS, PASSENGERS, ZONES } from './seedData';

export async function seedGeography(db: PrismaClient) {
  for (const zone of ZONES) {
    const location = await db.location.upsert({
      where: { code: zone.code },
      update: { name: zone.name },
      create: { code: zone.code, name: zone.name },
    });
    for (const sub of zone.subLocations) {
      await db.subLocation.upsert({
        where: { code: sub.code },
        update: { name: sub.name, lat: sub.lat, lng: sub.lng, locationId: location.id },
        create: { ...sub, locationId: location.id },
      });
    }
  }
}

/** Creates the cast only if missing, so re-running never resets wallets or trips. */
export async function seedPeople(db: PrismaClient) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const p of PASSENGERS) {
    await db.passenger.upsert({
      where: { phoneNumber: p.phoneNumber },
      update: {},
      create: { ...p, passwordHash },
    });
  }

  for (const d of DRIVERS) {
    const startAt = await db.subLocation.findUniqueOrThrow({ where: { code: d.startsOnlineAt } });
    const driver = await db.driver.upsert({
      where: { phoneNumber: d.phoneNumber },
      update: {},
      create: {
        name: d.name,
        phoneNumber: d.phoneNumber,
        licenseNumber: d.licenseNumber,
        passwordHash,
        isOnline: true,
        currentSubLocationId: startAt.id,
      },
    });
    await db.vehicle.upsert({
      where: { plateNumber: d.vehicle.plateNumber },
      update: {},
      create: { ...d.vehicle, driverId: driver.id },
    });
  }
}
