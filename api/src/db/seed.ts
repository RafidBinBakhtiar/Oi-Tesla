/**
 * Idempotent seed: safe to run on every container start. Only reference data
 * (zones, sub-locations) is upserted; no accounts are created.
 */
import { prisma } from '../lib/prisma';
import { seedGeography } from './seeders';

async function main() {
  await seedGeography(prisma);
  const [zones, subs] = await Promise.all([prisma.location.count(), prisma.subLocation.count()]);
  console.log(`Seed complete: ${zones} zones, ${subs} sub-locations`);
}

main()
  .catch((err) => {
    console.error('Seed failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
