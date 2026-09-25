'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FareBreakdown, RideProgress, RideStatusBadge, Route, SeatMeter, Timeline } from '@/components/RideBits';
import { RoleGate } from '@/components/RoleGate';
import { Empty, ErrorBanner, SkeletonCard } from '@/components/States';
import { clock, dateTime, taka } from '@/lib/format';
import { usePolling } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { RideDetail } from '@/lib/types';

export default function RideDetailPage() {
  return (
    <RoleGate role="passenger">
      <Detail />
    </RoleGate>
  );
}

const FARE_KIND_LABEL = { ESTIMATE: 'Estimate at request', QUOTE: 'Quote', FINAL: 'Final' } as const;

function Detail() {
  const { id } = useParams<{ id: string }>();
  const { request } = useSession();
  const { data: ride, error, loading, reload } = usePolling(
    () => request<RideDetail>('GET', `/api/rides/${id}`),
    null,
  );

  if (loading) return <div className="page"><SkeletonCard lines={6} /></div>;
  if (error?.status === 404) {
    return (
      <div className="page card">
        <Empty icon="🔍" title="Ride not found">
          It doesn&apos;t exist or isn&apos;t yours. <Link href="/passenger/history">Back to your rides</Link>
        </Empty>
      </div>
    );
  }
  if (error || !ride) return <div className="page"><ErrorBanner error={error} onRetry={reload} /></div>;

  return (
    <div className="page">
      <Link href="/passenger/history" className="subtle">
        ← All rides
      </Link>
      <div className="spread">
        <Route pickup={ride.pickup} dropoff={ride.dropoff} />
        <RideStatusBadge status={ride.status} />
      </div>
      <span className="subtle">Requested {dateTime(ride.requestedAt)}</span>
      <RideProgress status={ride.status} />
      {ride.cancelReason && <div className="alert warn">Cancelled: {ride.cancelReason}</div>}

      <div className="grid-2">
        <section className="card">
          <h2>Fare</h2>
          {ride.fare && <FareBreakdown fare={ride.fare} />}
          {ride.payment && (
            <div className="alert ok">
              Paid {taka(ride.payment.amountPaisa)} via {ride.payment.method}
              {ride.payment.note ? ` · ${ride.payment.note}` : ''}
            </div>
          )}
          <h3>How the price moved</h3>
          <ol className="timeline">
            {ride.fareHistory.map((f, i) => (
              <li key={i}>
                <time>{clock(f.calculatedAt)}</time>
                <div className="spread num">
                  <span>
                    {f.kind ? FARE_KIND_LABEL[f.kind] : ''}
                    {f.isPooled ? ` · pooled with ${f.coRiderCount}` : ' · solo'}
                  </span>
                  <strong>{taka(f.finalFarePaisa)}</strong>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h2>What happened</h2>
          <Timeline entries={ride.timeline} />
          {ride.pool && (
            <div className="item">
              <strong>
                {ride.pool.vehicle.modelName} · {ride.pool.driver.name}
              </strong>
              <SeatMeter occupied={ride.pool.occupiedSeats} capacity={ride.pool.capacity} />
              <span className="subtle">
                {ride.pool.coRiderCount > 0 ? `Shared with ${ride.pool.coRiderCount} other rider(s)` : 'Rode solo'}
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
