import { Router } from 'express';
import { prisma } from '../../lib/prisma';

export const healthRouter = Router();

/** Liveness + database reachability; used by the Docker health check. */
healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', uptimeSeconds: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});
