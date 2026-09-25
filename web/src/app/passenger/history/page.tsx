'use client';

import Link from 'next/link';
import { RideStatusBadge, Route } from '@/components/RideBits';
import { RoleGate } from '@/components/RoleGate';
import { Empty, ErrorBanner, SkeletonCard } from '@/components/States';
import { dateTime, km, taka } from '@/lib/format';
import { usePolling } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { Ride } from '@/lib/types';

export default function HistoryPage() {
  return (
    <RoleGate role="passenger">
      <History />
    </RoleGate>
  );
}

function History() {
  const { request } = useSession();
  const rides = usePolling(() => request<Ride[]>('GET', '/api/rides?limit=50'), null);

  return (
    <div className="page">
      <h1>Your rides</h1>
      <ErrorBanner error={rides.error} onRetry={rides.reload} />
      {rides.loading && <SkeletonCard />}
      {rides.data?.length === 0 && (
        <div className="card">
          <Empty icon="🛺" title="No rides yet">
            <Link href="/passenger">Book your first ride</Link>
          </Empty>
        </div>
      )}
      <div className="list">
        {rides.data?.map((ride) => (
          <Link key={ride.id} href={`/passenger/rides/${ride.id}`} className="item">
            <div className="spread">
              <Route pickup={ride.pickup} dropoff={ride.dropoff} />
              <RideStatusBadge status={ride.status} />
            </div>
            <div className="spread subtle num">
              <span>
                {dateTime(ride.requestedAt)} · {km(ride.distanceM)} · {ride.seats} seat{ride.seats > 1 ? 's' : ''}
                {ride.fare?.isPooled ? ' · pooled' : ''}
              </span>
              {ride.fare && ride.status !== 'CANCELLED' && (
                <strong style={{ color: 'var(--ink)' }}>{taka(ride.fare.finalFarePaisa)}</strong>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
