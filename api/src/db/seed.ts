/**
 * Idempotent seed: safe to run on every container start. Reference data
 * (zones, sub-locations) is upserted; people and Bullet are only created if
 * missing, so a restart never resets wallets or trip state.
 */
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/password';
import { DEMO_PASSWORD, DRIVERS, PASSENGERS, ZONES } from './seedData';

async function seedGeography() {
  for (const zone of ZONES) {
    const location = await prisma.location.upsert({
      where: { code: zone.code },
      update: { name: zone.name },
      create: { code: zone.code, name: zone.name },
    });
    for (const sub of zone.subLocations) {
      await prisma.subLocation.upsert({
        where: { code: sub.code },
        update: { name: sub.name, lat: sub.lat, lng: sub.lng, locationId: location.id },
        create: { ...sub, locationId: location.id },
      });
    }
  }
}

async function seedPeople() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const p of PASSENGERS) {
    await prisma.passenger.upsert({
      where: { phoneNumber: p.phoneNumber },
      update: {},
      create: { ...p, passwordHash },
    });
  }

  for (const d of DRIVERS) {
    const startAt = await prisma.subLocation.findUniqueOrThrow({ where: { code: d.startsOnlineAt } });
    const driver = await prisma.driver.upsert({
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
    await prisma.vehicle.upsert({
      where: { plateNumber: d.vehicle.plateNumber },
      update: {},
      create: { ...d.vehicle, driverId: driver.id },
    });
  }
}

async function main() {
  await seedGeography();
  await seedPeople();
  const [zones, subs, passengers, drivers] = await Promise.all([
    prisma.location.count(),
    prisma.subLocation.count(),
    prisma.passenger.count(),
    prisma.driver.count(),
  ]);
  console.log(`Seed complete: ${zones} zones, ${subs} sub-locations, ${passengers} passengers, ${drivers} drivers`);
}

main()
  .catch((err) => {
    console.error('Seed failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
