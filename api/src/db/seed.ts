/**
 * Idempotent seed: safe to run on every container start. Reference data
 * (zones, sub-locations) is upserted; people and Bullet are only created if
 * missing, so a restart never resets wallets or trip state.
 */
import { prisma } from '../lib/prisma';
import { seedGeography, seedPeople } from './seeders';

async function main() {
  await seedGeography(prisma);
  await seedPeople(prisma);
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
