'use client';

import { useEffect, useState } from 'react';
import { LocationSelect } from '@/components/LocationSelect';
import { ErrorBanner, SkeletonCard } from '@/components/States';
import { useAction, useZones } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import type { DriverUser } from '@/lib/types';

export function AvailabilityCard({ driver, busy, onChanged }: { driver: DriverUser; busy: boolean; onChanged: () => void }) {
  const { request, refreshUser } = useSession();
  const zones = useZones();
  const [subLocationId, setSubLocationId] = useState(driver.currentSubLocation?.id ?? '');

  useEffect(() => {
    if (driver.currentSubLocation) setSubLocationId(driver.currentSubLocation.id);
  }, [driver.currentSubLocation]);

  const toggle = useAction(async (online: boolean) => {
    await request('PATCH', '/api/driver/availability', online ? { online, subLocationId } : { online });
    await refreshUser();
    onChanged();
  });

  if (zones.loading) return <SkeletonCard lines={2} />;

  return (
    <section className="card">
      <div className="card-title">
        <div>
          <h2>
            {driver.vehicle?.modelName ?? 'No Tesla'}{' '}
            <span className="subtle">
              {driver.vehicle ? `${driver.vehicle.plateNumber} · ${driver.vehicle.capacity} seats` : ''}
            </span>
          </h2>
        </div>
        <span className={`badge ${driver.isOnline ? 'ok' : ''}`}>
          <span className="dot" aria-hidden />
          {driver.isOnline ? `Online at ${driver.currentSubLocation?.name ?? '—'}` : 'Offline'}
        </span>
      </div>

      {zones.data && (
        <LocationSelect
          id="parked-at"
          label="Parked at"
          zones={zones.data}
          value={subLocationId}
          onChange={setSubLocationId}
          disabled={busy}
        />
      )}
      {busy && <span className="subtle">You can&apos;t move or go offline while riders are assigned.</span>}

      <ErrorBanner error={toggle.error ?? zones.error} />
      <div className="row">
        {driver.isOnline ? (
          <>
            {subLocationId !== driver.currentSubLocation?.id && (
              <button type="button" className="btn" disabled={toggle.pending || busy} onClick={() => toggle.run(true)}>
                Move here
              </button>
            )}
            <button
              type="button"
              className="btn secondary"
              disabled={toggle.pending || busy}
              onClick={() => toggle.run(false)}
            >
              Go offline
            </button>
          </>
        ) : (
          <button type="button" className="btn" disabled={toggle.pending || !subLocationId} onClick={() => toggle.run(true)}>
            {toggle.pending ? 'Going online…' : 'Go online'}
          </button>
        )}
      </div>
    </section>
  );
}
