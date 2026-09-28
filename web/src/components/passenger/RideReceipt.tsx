'use client';

import Link from 'next/link';
import { FareBreakdown, RideStatusBadge, Route } from '@/components/RideBits';
import { SkeletonCard } from '@/components/States';
import { taka } from '@/lib/format';
import { usePolling } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { RideDetail } from '@/lib/types';

/** Shown once after a ride finishes, so the result doesn't just vanish. */
export function RideReceipt({ rideId, onDismiss }: { rideId: string; onDismiss: () => void }) {
  const { request } = useSession();
  const { data: ride } = usePolling(() => request<RideDetail>('GET', `/api/rides/${rideId}`), null);
  if (!ride) return <SkeletonCard />;

  const isTimeout = ride.status === 'CANCELLED' && ride.cancelReason?.startsWith('No driver found');
  const title =
    ride.status === 'COMPLETED' ? 'You have arrived 🎉' : isTimeout ? 'No drivers available' : 'Ride cancelled';

  return (
    <section className="card">
      <div className="card-title">
        <h2>{title}</h2>
        <RideStatusBadge status={ride.status} />
      </div>
      <Route pickup={ride.pickup} dropoff={ride.dropoff} />
      {isTimeout && (
        <div className="alert info">
          No driver accepted your request within 2 minutes. Please try again — drivers may be available shortly.
        </div>
      )}
      {ride.status === 'COMPLETED' && ride.fare && <FareBreakdown fare={ride.fare} />}
      {ride.payment && (
        <div className="alert ok">
          Paid {taka(ride.payment.amountPaisa)} by {ride.payment.method === 'CASH' ? 'cash' : 'TeslaPay'}
          {ride.payment.note ? ` · ${ride.payment.note}` : ''}
        </div>
      )}
      <div className="row">
        <button type="button" className="btn" onClick={onDismiss}>
          {isTimeout ? 'Try again' : 'Book another ride'}
        </button>
        <Link href={`/passenger/rides/${ride.id}`} className="btn secondary">
          Full details
        </Link>
      </div>
    </section>
  );
}
