import type { PoolStatus, RideStatus } from './types';

/** 5684 → "৳56.84". Money stays integer paisa until this moment. */
export const taka = (paisa: number) => `৳${(paisa / 100).toFixed(2)}`;

export const km = (metres: number) => `${(metres / 1000).toFixed(2)} km`;

export const minutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;

export const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: 'Looking for a Tesla',
  MATCHED: 'Matched',
  DRIVER_ARRIVED: 'Driver arrived',
  STARTED: 'On the way',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const POOL_STATUS_LABEL: Record<PoolStatus, string> = {
  OPEN: 'Open for riders',
  IN_PROGRESS: 'On the road',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
