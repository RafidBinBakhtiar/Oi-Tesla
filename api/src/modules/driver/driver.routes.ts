import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { authOf, requireRole } from '../../middleware/auth';
import { HistoryQuerySchema, isUuid } from '../rides/ride.schemas';
import * as driver from './driver.service';

/** Driver-facing endpoints. Drivers can only act on rides in their own pools. */
export const driverRouter = Router();
driverRouter.use(requireRole('driver'));

const AvailabilitySchema = z.object({
  online: z.boolean(),
  subLocationId: z.string().uuid().optional(),
});

const rideIdParam = (id: string) => {
  if (!isUuid(id)) throw notFound('Ride not found');
  return id;
};

driverRouter.patch('/availability', async (req, res) => {
  res.json(await driver.setAvailability(authOf(req).id, AvailabilitySchema.parse(req.body)));
});

driverRouter.get('/requests', async (req, res) => {
  res.json(await driver.listRelevantRequests(authOf(req).id));
});

driverRouter.post('/requests/:rideId/accept', async (req, res) => {
  res.json(await driver.acceptRequest(authOf(req).id, rideIdParam(req.params.rideId)));
});

driverRouter.get('/pool/current', async (req, res) => {
  res.json({ pool: await driver.getCurrentPool(authOf(req).id) });
});

driverRouter.get('/pools', async (req, res) => {
  const { limit } = HistoryQuerySchema.parse(req.query);
  res.json(await driver.listPoolHistory(authOf(req).id, limit));
});

driverRouter.post('/rides/:rideId/arrive', async (req, res) => {
  res.json(await driver.advanceRide(authOf(req).id, rideIdParam(req.params.rideId), 'DRIVER_ARRIVED'));
});

driverRouter.post('/rides/:rideId/start', async (req, res) => {
  res.json(await driver.advanceRide(authOf(req).id, rideIdParam(req.params.rideId), 'STARTED'));
});

driverRouter.post('/rides/:rideId/complete', async (req, res) => {
  res.json(await driver.advanceRide(authOf(req).id, rideIdParam(req.params.rideId), 'COMPLETED'));
});
