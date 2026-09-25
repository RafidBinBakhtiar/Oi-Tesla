import { Router } from 'express';
import { notFound } from '../../lib/errors';
import { authOf, requireRole } from '../../middleware/auth';
import { CancelRideSchema, CreateRideSchema, HistoryQuerySchema, isUuid, TripSchema } from './ride.schemas';
import * as rides from './ride.service';

/** Passenger-facing ride endpoints. Every query is scoped to the caller. */
export const rideRouter = Router();
rideRouter.use(requireRole('passenger'));

rideRouter.post('/estimate', async (req, res) => {
  res.json(await rides.estimate(TripSchema.parse(req.body)));
});

rideRouter.post('/', async (req, res) => {
  const result = await rides.createRide(authOf(req).id, CreateRideSchema.parse(req.body));
  res.status(201).json(result);
});

rideRouter.get('/', async (req, res) => {
  const { limit } = HistoryQuerySchema.parse(req.query);
  res.json(await rides.listMyRides(authOf(req).id, limit));
});

rideRouter.get('/current', async (req, res) => {
  res.json({ ride: await rides.getCurrentRide(authOf(req).id) });
});

rideRouter.get('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound('Ride not found');
  res.json(await rides.getMyRide(authOf(req).id, req.params.id));
});

rideRouter.post('/:id/cancel', async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound('Ride not found');
  const { reason } = CancelRideSchema.parse(req.body ?? {});
  res.json(await rides.cancelRide(authOf(req).id, req.params.id, reason));
});
