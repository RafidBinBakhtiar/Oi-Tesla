import { z } from 'zod';
import { RULES } from '../../domain/rules';

export const TripSchema = z
  .object({
    pickupId: z.string().uuid(),
    dropoffId: z.string().uuid(),
    seats: z.coerce.number().int().min(1).max(RULES.MAX_SEATS_PER_REQUEST).default(1),
  })
  .refine((t) => t.pickupId !== t.dropoffId, { message: 'Pickup and drop-off must differ', path: ['dropoffId'] });

export const CreateRideSchema = z
  .object({
    pickupId: z.string().uuid(),
    dropoffId: z.string().uuid(),
    seats: z.coerce.number().int().min(1).max(RULES.MAX_SEATS_PER_REQUEST).default(1),
    paymentMethod: z.enum(['CASH', 'TESLAPAY']).default('CASH'),
  })
  .refine((t) => t.pickupId !== t.dropoffId, { message: 'Pickup and drop-off must differ', path: ['dropoffId'] });

export const CancelRideSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Route ids that are not UUIDs can never exist — answer 404 instead of a DB error. */
export const isUuid = (v: string) => z.string().uuid().safeParse(v).success;
