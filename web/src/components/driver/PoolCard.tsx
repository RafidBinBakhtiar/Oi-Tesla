'use client';

import { PoolStatusBadge, RideStatusBadge, SeatMeter } from '@/components/RideBits';
import { Empty, ErrorBanner } from '@/components/States';
import { km, taka } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { DriverPool, PoolRider } from '@/lib/types';

const ACTION = {
  ARRIVE: { path: 'arrive', label: 'Mark arrived' },
  START: { path: 'start', label: 'Picked up — start' },
  COMPLETE: { path: 'complete', label: 'Dropped off' },
} as const;

export function PoolCard({ pool, onChanged }: { pool: DriverPool | null; onChanged: () => void }) {
  const { request, refreshUser } = useSession();
  const act = useAction(async (rider: PoolRider) => {
    if (!rider.nextAction) return;
    await request('POST', `/api/driver/rides/${rider.rideId}/${ACTION[rider.nextAction].path}`);
    if (rider.nextAction === 'COMPLETE') await refreshUser(); // location updates after drop-off
    onChanged();
  });

  if (!pool) {
    return (
      <section className="card">
        <h2>Current trip</h2>
        <Empty icon="🛺" title="No riders yet">
          Accept a request below. Compatible riders who book after that are pooled into your car automatically.
        </Empty>
      </section>
    );
  }

  const nameOf = (rideId: string) => pool.riders.find((r) => r.rideId === rideId)?.passengerName ?? '?';
  const toCollect = pool.riders
    .filter((r) => r.status !== 'CANCELLED' && r.paymentMethod === 'CASH' && !r.payment)
    .reduce((sum, r) => sum + (r.fare?.finalFarePaisa ?? 0), 0);

  return (
    <section className="card" aria-live="polite">
      <div className="card-title">
        <h2>Current trip</h2>
        <PoolStatusBadge status={pool.status} />
      </div>
      <div className="spread">
        <SeatMeter occupied={pool.occupiedSeats} capacity={pool.capacity} />
        {pool.status === 'OPEN' && pool.occupiedSeats < pool.capacity && (
          <span className="subtle">Open for riders heading the same way</span>
        )}
      </div>

      {pool.stops.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <h3>Stop order</h3>
          <ol className="stops">
            {pool.stops.map((stop, i) => (
              <li key={`${stop.kind}-${stop.place.id}`}>
                <span className={`pin ${stop.kind === 'PICKUP' ? 'pickup' : 'dropoff'}`}>{i + 1}</span>
                <div>
                  <strong>
                    {stop.kind === 'PICKUP' ? 'Pick up' : 'Drop'} at {stop.place.name}
                  </strong>
                  <div className="subtle">{stop.rideIds.map(nameOf).join(', ')}</div>
                </div>
              </li>
            ))}
          </ol>
          <span className="subtle num">Planned route {km(pool.plannedDistanceM)}</span>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <h3>Riders</h3>
        <ErrorBanner error={act.error} />
        <div className="list">
          {pool.riders.map((r) => (
            <div key={r.rideId} className={`item ${r.status === 'CANCELLED' ? 'dim' : ''}`}>
              <div className="spread">
                <div className="row" style={{ gap: 10 }}>
                  <span className="avatar" aria-hidden>
                    {r.passengerName[0]}
                  </span>
                  <div>
                    <strong>
                      {r.passengerName}
                      {r.seats > 1 ? ` · ${r.seats} seats` : ''}
                    </strong>
                    <div className="subtle">
                      {r.pickup.name} → {r.dropoff.name}
                    </div>
                  </div>
                </div>
                <RideStatusBadge status={r.status} />
              </div>
              <div className="spread">
                <span className="subtle num">
                  {r.fare ? taka(r.fare.finalFarePaisa) : '—'} · {r.paymentMethod === 'CASH' ? 'cash' : 'TeslaPay'}
                  {r.fare?.isPooled ? ' · pooled' : ''}
                  {r.payment ? ' · paid' : ''}
                </span>
                {r.nextAction && (
                  <button type="button" className="btn small" disabled={act.pending} onClick={() => act.run(r)}>
                    {ACTION[r.nextAction].label}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {toCollect > 0 && <div className="alert info num">Cash still to collect: {taka(toCollect)}</div>}
    </section>
  );
}
