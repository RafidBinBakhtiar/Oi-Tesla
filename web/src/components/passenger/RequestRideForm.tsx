'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { LocationSelect } from '@/components/LocationSelect';
import { ErrorBanner, SkeletonCard, Spinner } from '@/components/States';
import { km, minutes, taka } from '@/lib/format';
import { useAction, useZones } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { CreateRideResponse, Estimate, PaymentMethod } from '@/lib/types';

interface Props {
  walletBalancePaisa: number;
  onRequested: (result: CreateRideResponse) => void;
}

export function RequestRideForm({ walletBalancePaisa, onRequested }: Props) {
  const { request } = useSession();
  const zones = useZones();
  const [pickupId, setPickupId] = useState('');
  const [dropoffId, setDropoffId] = useState('');
  const [seats, setSeats] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Live estimate whenever the trip changes; stale responses are ignored.
  useEffect(() => {
    setEstimate(null);
    if (!pickupId || !dropoffId || pickupId === dropoffId) return;
    let stale = false;
    setEstimating(true);
    request<Estimate>('POST', '/api/rides/estimate', { pickupId, dropoffId, seats })
      .then((e) => !stale && setEstimate(e))
      .catch(() => !stale && setEstimate(null))
      .finally(() => !stale && setEstimating(false));
    return () => {
      stale = true;
    };
  }, [pickupId, dropoffId, seats, request]);

  const submit = useAction(async () =>
    onRequested(
      await request<CreateRideResponse>('POST', '/api/rides', { pickupId, dropoffId, seats, paymentMethod }),
    ),
  );

  if (zones.loading) return <SkeletonCard lines={4} />;
  if (zones.error || !zones.data) return <ErrorBanner error={zones.error} onRetry={zones.reload} />;

  const walletShort = estimate && paymentMethod === 'TESLAPAY' && walletBalancePaisa < estimate.solo.finalFarePaisa;

  return (
    <form
      className="card"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void submit.run();
      }}
    >
      <div className="card-title">
        <h2>Where to?</h2>
        <span className="subtle">Pooling is automatic when someone is heading your way</span>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <LocationSelect id="pickup" label="Pickup" zones={zones.data} value={pickupId} onChange={setPickupId} />
        <LocationSelect
          id="dropoff"
          label="Drop-off"
          zones={zones.data}
          value={dropoffId}
          onChange={setDropoffId}
          exclude={pickupId}
        />
      </div>

      <div className="spread">
        <div className="stack" style={{ gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Seats</span>
          <div className="segmented" role="group" aria-label="Seats">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" aria-pressed={seats === n} onClick={() => setSeats(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pay with</span>
          <div className="segmented" role="group" aria-label="Payment method">
            <button type="button" aria-pressed={paymentMethod === 'CASH'} onClick={() => setPaymentMethod('CASH')}>
              Cash
            </button>
            <button
              type="button"
              aria-pressed={paymentMethod === 'TESLAPAY'}
              onClick={() => setPaymentMethod('TESLAPAY')}
            >
              TeslaPay · {taka(walletBalancePaisa)}
            </button>
          </div>
        </div>
      </div>

      {estimating && <Spinner label="Estimating fare…" />}
      {estimate && (
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="item">
            <span className="subtle">If you ride alone</span>
            <span className="price num">{taka(estimate.solo.finalFarePaisa)}</span>
            <span className="subtle num">
              {km(estimate.distanceM)} · about {minutes(estimate.soloDurationSeconds)}
            </span>
          </div>
          <div className="item" style={{ borderColor: 'var(--ok)' }}>
            <span className="subtle">If you share (25% off distance)</span>
            <span className="price num" style={{ color: 'var(--ok)' }}>
              {taka(estimate.pooled.finalFarePaisa)}
            </span>
            <span className="subtle">Save {taka(estimate.solo.finalFarePaisa - estimate.pooled.finalFarePaisa)}</span>
          </div>
        </div>
      )}
      {walletShort && (
        <div className="alert warn">
          Your TeslaPay balance ({taka(walletBalancePaisa)}) doesn&apos;t cover the solo price. Choose cash.
        </div>
      )}

      <ErrorBanner error={submit.error} />
      <button className="btn block" disabled={!estimate || submit.pending || Boolean(walletShort)}>
        {submit.pending ? 'Finding you a Tesla…' : 'Request ride'}
      </button>
    </form>
  );
}
