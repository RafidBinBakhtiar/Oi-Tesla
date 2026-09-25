import type { ActorType, PoolStatus, RideStatus } from '@prisma/client';
import { AppError } from '../lib/errors';

/**
 * Allowed ride transitions and who may perform each one. Anything not listed
 * here is illegal — including skipping steps (MATCHED → STARTED) and going
 * backwards (COMPLETED → anything).
 */
const TRANSITIONS: Record<RideStatus, Partial<Record<RideStatus, readonly ActorType[]>>> = {
  REQUESTED: { MATCHED: ['SYSTEM', 'DRIVER'], CANCELLED: ['PASSENGER'] },
  MATCHED: { DRIVER_ARRIVED: ['DRIVER'], CANCELLED: ['PASSENGER'] },
  DRIVER_ARRIVED: { STARTED: ['DRIVER'], CANCELLED: ['PASSENGER'] },
  STARTED: { COMPLETED: ['DRIVER'] },
  COMPLETED: {},
  CANCELLED: {},
};

/** Statuses in which a ride occupies seats in a pool. */
export const IN_POOL_STATUSES: readonly RideStatus[] = ['MATCHED', 'DRIVER_ARRIVED', 'STARTED'];
/** Statuses that count as "the passenger has a ride in flight". */
export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = ['REQUESTED', ...IN_POOL_STATUSES];
/** Before pickup the fare may still change as co-riders join or leave. */
export const REQUOTABLE_STATUSES: readonly RideStatus[] = ['MATCHED', 'DRIVER_ARRIVED'];

export function canTransition(from: RideStatus, to: RideStatus, actor: ActorType): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

export function assertTransition(from: RideStatus, to: RideStatus, actor: ActorType): void {
  if (!canTransition(from, to, actor)) {
    throw new AppError(409, 'INVALID_TRANSITION', `A ride cannot go from ${from} to ${to} (by ${actor.toLowerCase()})`, {
      from,
      to,
    });
  }
}

export const isCancellable = (status: RideStatus) => canTransition(status, 'CANCELLED', 'PASSENGER');

/**
 * Pool status is derived from its members, never set by hand:
 *   nobody active     → COMPLETED if anyone finished, else CANCELLED
 *   anyone picked up  → IN_PROGRESS (closed to new riders)
 *   otherwise         → OPEN
 */
export function derivePoolStatus(memberStatuses: readonly RideStatus[]): PoolStatus {
  const active = memberStatuses.filter((s) => IN_POOL_STATUSES.includes(s));
  if (active.length === 0) return memberStatuses.includes('COMPLETED') ? 'COMPLETED' : 'CANCELLED';
  if (memberStatuses.some((s) => s === 'STARTED' || s === 'COMPLETED')) return 'IN_PROGRESS';
  return 'OPEN';
}
