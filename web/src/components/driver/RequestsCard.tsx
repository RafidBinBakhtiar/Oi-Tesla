'use client';

import { Empty, ErrorBanner } from '@/components/States';
import { clock, km, taka } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import type { ApiError } from '@/lib/session';
import { useSession } from '@/lib/session';
import type { RelevantRequests } from '@/lib/types';

interface Props {
  data: RelevantRequests | undefined;
  error: ApiError | null;
  onAccepted: () => void;
}

export function RequestsCard({ data, error, onAccepted }: Props) {
  const { request } = useSession();
  const accept = useAction(async (rideId: string) => {
    await request('POST', `/api/driver/requests/${rideId}/accept`);
    onAccepted();
  });

  return (
    <section className="card">
      <div className="card-title">
        <h2>Ride requests</h2>
        {data?.zone && <span className="badge">{data.zone.name}</span>}
      </div>
      <ErrorBanner error={error ?? accept.error} />

      {data && !data.online && (
        <Empty icon="🌙" title="You're offline">
          Go online to see passengers waiting near you.
        </Empty>
      )}
      {data?.online && data.requests.length === 0 && (
        <Empty icon="⏳" title="Nobody waiting in your zone">
          New requests show up here automatically.
        </Empty>
      )}

      <div className="list">
        {data?.requests.map((r) => (
          <div key={r.rideId} className={`item ${r.canAccept ? '' : 'dim'}`}>
            <div className="spread">
              <strong>
                {r.passengerName}
                {r.seats > 1 ? ` · ${r.seats} seats` : ''}
              </strong>
              <span className="subtle num">since {clock(r.requestedAt)}</span>
            </div>
            <div className="route" style={{ fontWeight: 500 }}>
              {r.pickup.name} <span className="arrow">→</span> {r.dropoff.name}
            </div>
            <div className="spread">
              <span className="subtle num">
                {km(r.distanceM)} · {taka(r.soloFarePaisa)} solo / {taka(r.pooledFarePaisa)} pooled
              </span>
              <button
                type="button"
                className="btn small"
                disabled={!r.canAccept || accept.pending}
                onClick={() => accept.run(r.rideId)}
              >
                Accept
              </button>
            </div>
            {r.reason && (
              <span className={`subtle`} style={{ color: r.canAccept ? 'var(--ok)' : 'var(--warn)' }}>
                {r.reason}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
