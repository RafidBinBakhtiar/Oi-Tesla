'use client';

import { useEffect, useState } from 'react';
import { FareBreakdown, RideProgress, RideStatusBadge, Route, SeatMeter, Timeline } from '@/components/RideBits';
import { ErrorBanner } from '@/components/States';
import { useAction } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { RideDetail } from '@/lib/types';

const SEARCH_TIMEOUT_S = 120;

function SearchCountdown({ requestedAt }: { requestedAt: string }) {
  const elapsed = () => Math.floor((Date.now() - new Date(requestedAt).getTime()) / 1000);
  const [secs, setSecs] = useState(elapsed);

  useEffect(() => {
    setSecs(elapsed());
    const id = setInterval(() => setSecs(elapsed()), 1000);
    return () => clearInterval(id);
  }, [requestedAt]);

  const remaining = Math.max(0, SEARCH_TIMEOUT_S - secs);
  const pct = Math.min(100, (secs / SEARCH_TIMEOUT_S) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="subtle">Searching for a driver…</span>
        <span className="subtle num">{remaining}s</span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: remaining < 20 ? 'var(--danger)' : 'var(--accent)',
            borderRadius: 2,
            transition: 'width 1s linear, background 0.3s',
          }}
        />
      </div>
      {remaining === 0 && <span className="subtle">Wrapping up — no driver found. Reloading…</span>}
    </div>
  );
}

function headline(ride: RideDetail) {
  const pool = ride.pool;
  switch (ride.status) {
    case 'REQUESTED':
      return 'Looking for a Tesla heading your way… nearby drivers can see your request.';
    case 'MATCHED':
      return `${pool?.driver.name} is bringing ${pool?.vehicle.modelName} to ${ride.pickup.name}.`;
    case 'DRIVER_ARRIVED':
      return `${pool?.driver.name} is waiting for you at ${ride.pickup.name}.`;
    case 'STARTED':
      return `On the way to ${ride.dropoff.name}.`;
    default:
      return '';
  }
}

export function CurrentRideCard({ ride, onChanged }: { ride: RideDetail; onChanged: () => void }) {
  const { request } = useSession();
  const [confirming, setConfirming] = useState(false);
  const cancel = useAction(async () => {
    await request('POST', `/api/rides/${ride.id}/cancel`, { reason: 'Cancelled from the app' });
    setConfirming(false);
    onChanged();
  });

  return (
    <section className="card" aria-live="polite">
      <div className="card-title">
        <Route pickup={ride.pickup} dropoff={ride.dropoff} />
        <RideStatusBadge status={ride.status} />
      </div>
      <RideProgress status={ride.status} />
      <p>{headline(ride)}</p>
      {ride.status === 'REQUESTED' && <SearchCountdown requestedAt={ride.requestedAt} />}

      {ride.pool && (
        <div className="item">
          <div className="spread">
            <div>
              <strong>
                {ride.pool.vehicle.modelName} · {ride.pool.driver.name}
              </strong>
              <div className="subtle">
                {ride.pool.vehicle.plateNumber} · {ride.pool.driver.phoneNumber}
              </div>
            </div>
            <SeatMeter occupied={ride.pool.occupiedSeats} capacity={ride.pool.capacity} />
          </div>
          <span className={`badge ${ride.pool.coRiderCount > 0 ? 'ok' : ''}`}>
            {ride.pool.coRiderCount > 0
              ? `Sharing with ${ride.pool.coRiderCount} other rider${ride.pool.coRiderCount > 1 ? 's' : ''}`
              : 'Riding solo so far'}
          </span>
        </div>
      )}

      {ride.fare && (
        <div className="stack" style={{ gap: 6 }}>
          <FareBreakdown fare={ride.fare} />
          <span className="subtle">
            {ride.status === 'STARTED'
              ? `Fare locked at pickup · ${ride.paymentMethod === 'CASH' ? 'pay cash' : 'TeslaPay'} on arrival`
              : 'Your fare drops if someone shares your Tesla. It locks when you are picked up.'}
          </span>
        </div>
      )}

      <details>
        <summary className="subtle" style={{ cursor: 'pointer' }}>
          What happened so far
        </summary>
        <div style={{ marginTop: 10 }}>
          <Timeline entries={ride.timeline} />
        </div>
      </details>

      <ErrorBanner error={cancel.error} />
      {ride.canCancel &&
        (confirming ? (
          <div className="row">
            <span className="muted">Cancel this ride?</span>
            <button type="button" className="btn danger small" onClick={() => cancel.run()} disabled={cancel.pending}>
              {cancel.pending ? 'Cancelling…' : 'Yes, cancel'}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" className="btn secondary" onClick={() => setConfirming(true)}>
            Cancel ride
          </button>
        ))}
    </section>
  );
}
