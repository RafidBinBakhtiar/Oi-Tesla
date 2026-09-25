'use client';

import { useCallback } from 'react';
import { AvailabilityCard } from '@/components/driver/AvailabilityCard';
import { PoolCard } from '@/components/driver/PoolCard';
import { RequestsCard } from '@/components/driver/RequestsCard';
import { RoleGate } from '@/components/RoleGate';
import { ErrorBanner, SkeletonCard } from '@/components/States';
import { usePolling } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { DriverPool, RelevantRequests } from '@/lib/types';

export default function DriverPage() {
  return (
    <RoleGate role="driver">
      <DriverDashboard />
    </RoleGate>
  );
}

function DriverDashboard() {
  const { request, user } = useSession();
  const pool = usePolling(() => request<{ pool: DriverPool | null }>('GET', '/api/driver/pool/current'), 3000);
  const requests = usePolling(() => request<RelevantRequests>('GET', '/api/driver/requests'), 3000);

  const reloadAll = useCallback(() => {
    void pool.reload();
    void requests.reload();
  }, [pool, requests]);

  if (user?.role !== 'driver') return null;
  const current = pool.data?.pool ?? null;

  return (
    <div className="page">
      <h1>Assalamu alaikum, {user.name}</h1>
      <div className="grid-2">
        <div className="stack" style={{ gap: 20 }}>
          <AvailabilityCard driver={user} busy={Boolean(current)} onChanged={reloadAll} />
          <ErrorBanner error={pool.error} onRetry={pool.reload} />
          {pool.loading ? <SkeletonCard lines={5} /> : <PoolCard pool={current} onChanged={reloadAll} />}
        </div>
        {requests.loading ? (
          <SkeletonCard lines={4} />
        ) : (
          <RequestsCard data={requests.data} error={requests.error} onAccepted={reloadAll} />
        )}
      </div>
    </div>
  );
}
