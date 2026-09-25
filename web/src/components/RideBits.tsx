import { clock, km, POOL_STATUS_LABEL, RIDE_STATUS_LABEL, taka } from '@/lib/format';
import type { Fare, Named, PoolStatus, RideStatus, TimelineEntry } from '@/lib/types';

const RIDE_TONE: Record<RideStatus, string> = {
  REQUESTED: 'warn',
  MATCHED: 'info',
  DRIVER_ARRIVED: 'brand',
  STARTED: 'brand',
  COMPLETED: 'ok',
  CANCELLED: '',
};

const POOL_TONE: Record<PoolStatus, string> = {
  OPEN: 'info',
  IN_PROGRESS: 'brand',
  COMPLETED: 'ok',
  CANCELLED: '',
};

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return (
    <span className={`badge ${RIDE_TONE[status]}`}>
      <span className="dot" aria-hidden />
      {RIDE_STATUS_LABEL[status]}
    </span>
  );
}

export function PoolStatusBadge({ status }: { status: PoolStatus }) {
  return <span className={`badge ${POOL_TONE[status]}`}>{POOL_STATUS_LABEL[status]}</span>;
}

const STEPS: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED'];
const STEP_LABEL: Record<string, string> = {
  REQUESTED: 'Requested',
  MATCHED: 'Matched',
  DRIVER_ARRIVED: 'Arrived',
  STARTED: 'Riding',
  COMPLETED: 'Done',
};

/** REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED */
export function RideProgress({ status }: { status: RideStatus }) {
  if (status === 'CANCELLED') return null;
  const at = STEPS.indexOf(status);
  return (
    <div className="progress" aria-label={`Ride progress: ${RIDE_STATUS_LABEL[status]}`}>
      {STEPS.map((s, i) => (
        <div key={s} className={`step ${i < at ? 'done' : ''} ${i === at ? 'current' : ''}`}>
          <div className="bar" />
          <span>{STEP_LABEL[s]}</span>
        </div>
      ))}
    </div>
  );
}

export function Route({ pickup, dropoff }: { pickup: Named; dropoff: Named }) {
  return (
    <div className="route">
      <span>{pickup.name}</span>
      <span className="arrow" aria-label="to">
        →
      </span>
      <span>{dropoff.name}</span>
    </div>
  );
}

/** The fare formula, line by line, so anyone can check it by hand. */
export function FareBreakdown({ fare }: { fare: Fare }) {
  return (
    <div className="fare num">
      <div className="line">
        <span className="muted">Base fare</span>
        <span>{taka(fare.baseFarePaisa)}</span>
      </div>
      <div className="line">
        <span className="muted">
          Distance {km(fare.distanceM)} × ৳20/km{fare.seats > 1 ? ` × ${fare.seats} seats` : ''}
        </span>
        <span>{taka(fare.distanceFarePaisa)}</span>
      </div>
      {fare.poolDiscountPaisa > 0 && (
        <div className="line discount">
          <span>Pool discount (25% of distance)</span>
          <span>−{taka(fare.poolDiscountPaisa)}</span>
        </div>
      )}
      <div className="line total">
        <span>{fare.kind === 'FINAL' ? 'You paid' : fare.kind === 'QUOTE' ? 'Your fare' : 'Estimated fare'}</span>
        <span>{taka(fare.finalFarePaisa)}</span>
      </div>
    </div>
  );
}

export function SeatMeter({ occupied, capacity }: { occupied: number; capacity: number }) {
  return (
    <div className="row" aria-label={`${occupied} of ${capacity} seats taken`}>
      <div className="seats">
        {Array.from({ length: capacity }, (_, i) => (
          <span key={i} className={`seat ${i < occupied ? 'taken' : ''}`} aria-hidden>
            {i < occupied ? '●' : ''}
          </span>
        ))}
      </div>
      <span className="muted num">
        {occupied}/{capacity} seats
      </span>
    </div>
  );
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="timeline">
      {entries.map((e, i) => (
        <li key={i}>
          <time dateTime={e.at}>{clock(e.at)}</time>
          <div>
            <strong>{RIDE_STATUS_LABEL[e.to]}</strong>
            {e.note && <div className="muted">{e.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
