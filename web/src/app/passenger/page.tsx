'use client';

import { useEffect, useState } from 'react';
import { CurrentRideCard } from '@/components/passenger/CurrentRideCard';
import { RequestRideForm } from '@/components/passenger/RequestRideForm';
import { RideReceipt } from '@/components/passenger/RideReceipt';
import { RoleGate } from '@/components/RoleGate';
import { ErrorBanner, SkeletonCard } from '@/components/States';
import { taka } from '@/lib/format';
import { usePolling } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { CreateRideResponse, RideDetail } from '@/lib/types';

export default function PassengerPage() {
  return (
    <RoleGate role="passenger">
      <PassengerHome />
    </RoleGate>
  );
}

function PassengerHome() {
  const { request, user, refreshUser } = useSession();
  const current = usePolling(() => request<{ ride: RideDetail | null }>('GET', '/api/rides/current'), 3000);
  const [lastRideId, setLastRideId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'info'; text: string } | null>(null);

  const ride = current.data?.ride ?? null;
  useEffect(() => {
    if (ride) setLastRideId(ride.id);
  }, [ride]);

  // A ride that was active and no longer is has just finished or been cancelled.
  const finishedRideId = !ride && lastRideId ? lastRideId : null;
  useEffect(() => {
    if (finishedRideId) void refreshUser(); // wallet may have been debited
  }, [finishedRideId, refreshUser]);

  function onRequested(result: CreateRideResponse) {
    setFlash(
      result.autoMatch.matched
        ? {
            tone: 'ok',
            text: `Pooled! You're sharing ${result.ride.pool?.vehicle.modelName} with ${result.ride.pool?.coRiderCount} other rider(s).`,
          }
        : { tone: 'info', text: result.autoMatch.reason ?? 'Waiting for a driver to accept.' },
    );
    void current.reload();
  }

  const wallet = user?.role === 'passenger' ? user.walletBalancePaisa : 0;

  return (
    <div className="page">
      <div className="spread">
        <h1>Hi {user?.name} 👋</h1>
        <span className="badge">TeslaPay {taka(wallet)}</span>
      </div>

      {flash && ride && <div className={`alert ${flash.tone}`}>{flash.text}</div>}
      <ErrorBanner error={current.error} onRetry={current.reload} />

      {current.loading ? (
        <SkeletonCard lines={5} />
      ) : ride ? (
        <CurrentRideCard ride={ride} onChanged={current.reload} />
      ) : finishedRideId ? (
        <RideReceipt
          rideId={finishedRideId}
          onDismiss={() => {
            setLastRideId(null);
            setFlash(null);
          }}
        />
      ) : (
        !current.error && <RequestRideForm walletBalancePaisa={wallet} onRequested={onRequested} />
      )}
    </div>
  );
}
