import { Router } from 'express';
import { prisma } from '../../lib/prisma';

export const locationsRouter = Router();

/** Public reference data: zones with their pickup / drop-off points. */
locationsRouter.get('/', async (_req, res) => {
  const zones = await prisma.location.findMany({
    orderBy: { name: 'asc' },
    include: { subLocations: { orderBy: { name: 'asc' } } },
  });
  res.set('Cache-Control', 'public, max-age=300');
  res.json(
    zones.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      subLocations: z.subLocations.map((s) => ({ id: s.id, code: s.code, name: s.name, lat: s.lat, lng: s.lng })),
    })),
  );
});
