import type { PrismaClient } from '@prisma/client';
import { ZONES } from './seedData';

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
