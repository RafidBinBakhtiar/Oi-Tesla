import type { ActorType, RideStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  derivePoolStatus,
  isCancellable,
} from '../../src/domain/rideStateMachine';

const ALL: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED'];
const ACTORS: ActorType[] = ['PASSENGER', 'DRIVER', 'SYSTEM'];

describe('ride state machine', () => {
  it('walks the happy path REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED', () => {
    expect(canTransition('REQUESTED', 'MATCHED', 'SYSTEM')).toBe(true);
    expect(canTransition('REQUESTED', 'MATCHED', 'DRIVER')).toBe(true);
    expect(canTransition('MATCHED', 'DRIVER_ARRIVED', 'DRIVER')).toBe(true);
    expect(canTransition('DRIVER_ARRIVED', 'STARTED', 'DRIVER')).toBe(true);
    expect(canTransition('STARTED', 'COMPLETED', 'DRIVER')).toBe(true);
  });

  it('allows exactly 7 transitions in total — everything else is rejected', () => {
    const allowed = ALL.flatMap((from) =>
      ALL.flatMap((to) => ACTORS.filter((a) => canTransition(from, to, a)).map((a) => `${from}>${to}:${a}`)),
    );
    expect(allowed.sort()).toEqual(
      [
        'REQUESTED>MATCHED:SYSTEM',
        'REQUESTED>MATCHED:DRIVER',
        'REQUESTED>CANCELLED:PASSENGER',
        'MATCHED>DRIVER_ARRIVED:DRIVER',
        'MATCHED>CANCELLED:PASSENGER',
        'DRIVER_ARRIVED>STARTED:DRIVER',
        'DRIVER_ARRIVED>CANCELLED:PASSENGER',
        'STARTED>COMPLETED:DRIVER',
      ].sort(),
    );
  });

  it('rejects skipping steps and going backwards', () => {
    expect(() => assertTransition('MATCHED', 'STARTED', 'DRIVER')).toThrow(/cannot go from MATCHED to STARTED/);
    expect(() => assertTransition('REQUESTED', 'COMPLETED', 'DRIVER')).toThrow();
    expect(() => assertTransition('COMPLETED', 'STARTED', 'DRIVER')).toThrow();
    expect(() => assertTransition('CANCELLED', 'MATCHED', 'SYSTEM')).toThrow();
  });

  it('rejects the right step by the wrong actor', () => {
    // RiderA cannot mark her own trip as started; DriverA cannot cancel for her.
    expect(canTransition('DRIVER_ARRIVED', 'STARTED', 'PASSENGER')).toBe(false);
    expect(canTransition('MATCHED', 'CANCELLED', 'DRIVER')).toBe(false);
  });

  it('only allows cancelling before pickup', () => {
    expect(ALL.filter(isCancellable)).toEqual(['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED']);
  });

  it('carries a 409 INVALID_TRANSITION error', () => {
    try {
      assertTransition('STARTED', 'CANCELLED', 'PASSENGER');
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
    }
  });
});

describe('derived pool status', () => {
  it('is OPEN while nobody is on board', () => {
    expect(derivePoolStatus(['MATCHED', 'DRIVER_ARRIVED'])).toBe('OPEN');
  });

  it('is IN_PROGRESS once anyone is picked up, and stays so after the first drop-off', () => {
    expect(derivePoolStatus(['STARTED', 'MATCHED'])).toBe('IN_PROGRESS');
    expect(derivePoolStatus(['COMPLETED', 'STARTED'])).toBe('IN_PROGRESS');
  });

  it('is COMPLETED when everyone left and someone finished', () => {
    expect(derivePoolStatus(['COMPLETED', 'CANCELLED', 'COMPLETED'])).toBe('COMPLETED');
  });

  it('is CANCELLED when every rider cancelled', () => {
    expect(derivePoolStatus(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
  });
});
