'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CastPicker } from '@/components/CastPicker';
import { homeFor, useSession } from '@/lib/session';

export default function Landing() {
  const { ready, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user.role));
  }, [ready, user, router]);

  return (
    <div className="page">
      <section className="hero">
        <span className="badge brand">8:41 AM · Banani Road 11</span>
        <h1>Share a seat. Split the fare. Survive Dhaka traffic.</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Request a ride and, when someone is heading the same way, share a Tesla with them. Each passenger sees
          only their own fare and status. The driver sees exactly who is riding and in what order to drop them off.
        </p>
        <div className="row">
          <Link href="/login?role=passenger" className="btn">
            I need a ride
          </Link>
          <Link href="/login?role=driver" className="btn secondary">
            I drive a Tesla
          </Link>
          <Link href="/signup" className="btn ghost">
            Create a passenger account
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Jump in as the story cast</h2>
          <span className="subtle">Demo password: oitesla123</span>
        </div>
        <CastPicker />
      </section>

      <section className="grid-2">
        <div className="card tight">
          <h3>How pooling works</h3>
          <p className="muted">
            A request joins a Tesla that is still waiting at the pickup zone if it heads the same way (within 60°),
            fits the remaining seats, and adds no more than 5 minutes to anyone&apos;s trip.
          </p>
        </div>
        <div className="card tight">
          <h3>How fares work</h3>
          <p className="muted">
            ৳30 base + ৳20 per km per seat. When you share, you get 25% off the distance part, and you only ever
            pay for your own pickup-to-drop-off distance.
          </p>
        </div>
      </section>
    </div>
  );
}
