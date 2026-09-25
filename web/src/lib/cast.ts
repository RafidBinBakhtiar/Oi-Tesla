import type { Role } from './types';

/** The seeded story cast — one click to sign in as any of them during a demo. */
export const DEMO_PASSWORD = 'oitesla123';

export const CAST: { name: string; role: Role; phoneNumber: string; blurb: string }[] = [
  { name: 'Nusrat', role: 'passenger', phoneNumber: '01711000001', blurb: 'Late for Mohakhali' },
  { name: 'Rafiq', role: 'passenger', phoneNumber: '01711000002', blurb: 'Heading to Gulshan 1' },
  { name: 'Shirin', role: 'passenger', phoneNumber: '01711000003', blurb: 'Wants the last seat (৳40 TeslaPay)' },
  { name: 'Jashim', role: 'driver', phoneNumber: '01811000001', blurb: 'Drives Bullet, 3 seats' },
];
