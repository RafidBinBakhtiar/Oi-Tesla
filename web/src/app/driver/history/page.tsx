'use client';

import { PoolStatusBadge, RideStatusBadge } from '@/components/RideBits';
import { RoleGate } from '@/components/RoleGate';
import { Empty, ErrorBanner, SkeletonCard } from '@/components/States';
import { dateTime, taka } from '@/lib/format';
import { usePolling } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { DriverPool } from '@/lib/types';

export default function DriverHistoryPage() {
  return (
    <RoleGate role="driver">
      <DriverHistory />
    </RoleGate>
  );
}

function DriverHistory() {
  const { request } = useSession();
  const pools = usePolling(() => request<DriverPool[]>('GET', '/api/driver/pools?limit=50'), null);

  return (
    <div className="page">
      <h1>Your trips</h1>
      <ErrorBanner error={pools.error} onRetry={pools.reload} />
      {pools.loading && <SkeletonCard />}
      {pools.data?.length === 0 && (
        <div className="card">
          <Empty icon="🛺" title="No trips yet">
            Accepted pools show up here with every rider and fare.
          </Empty>
        </div>
      )}
      <div className="list">
        {pools.data?.map((pool) => {
          const earned = pool.riders.reduce((sum, r) => sum + (r.payment?.amountPaisa ?? 0), 0);
          return (
            <div key={pool.id} className="card tight">
              <div className="spread">
                <strong>
                  {dateTime(pool.createdAt)} · from {pool.origin.name}
                </strong>
                <PoolStatusBadge status={pool.status} />
              </div>
              <div className="list">
                {pool.riders.map((r) => (
                  <div key={r.rideId} className="spread">
                    <span>
                      {r.passengerName} <span className="subtle">
                        {r.pickup.name} → {r.dropoff.name}
                        {r.seats > 1 ? ` · ${r.seats} seats` : ''}
                      </span>
                    </span>
                    <span className="row" style={{ gap: 8 }}>
                      {r.payment && <span className="subtle num">{taka(r.payment.amountPaisa)}</span>}
                      <RideStatusBadge status={r.status} />
                    </span>
                  </div>
                ))}
              </div>
              {earned > 0 && <span className="subtle num">Collected {taka(earned)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
