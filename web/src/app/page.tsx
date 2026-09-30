'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Reveal, Tilt, useReducedMotion } from '@/components/landing/motion';
import { homeFor, useSession } from '@/lib/session';

const CityScene = dynamic(() => import('@/components/landing/CityScene'), {
  ssr: false,
  loading: () => <div className="scene-fallback" aria-hidden />,
});

const Icon = {
  pool: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M10 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 14l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 9l2 5v4h-3M6 18H3v-4h18" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14.5h2" />
    </svg>
  ),
  steer: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3.5 10h6M14.5 10h6M12 14.5V21" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <path d="M4 20L20 4" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
      <path d="M5 19l7-7" />
    </svg>
  ),
};

const SERVICES: { icon: ReactNode; title: string; body: string; href: string; cta: string; accent?: boolean }[] = [
  {
    icon: Icon.pool,
    title: 'Pool',
    body: 'Share a Tesla with people heading your way and pay less for the same trip.',
    href: '/signup',
    cta: 'Book a pool',
    accent: true,
  },
  {
    icon: Icon.car,
    title: 'Solo',
    body: 'Nobody going your way? You still get the whole Tesla at a fair, upfront price.',
    href: '/signup',
    cta: 'Create an account',
  },
  {
    icon: Icon.wallet,
    title: 'TeslaPay',
    body: 'Pay from your wallet at drop-off, or hand the driver cash. Your choice, every trip.',
    href: '/signup',
    cta: 'Open a wallet',
  },
  {
    icon: Icon.steer,
    title: 'Drive',
    body: 'Fill every seat on every trip. More riders per kilometre means more for you.',
    href: '/login?role=driver',
    cta: 'Start driving',
  },
];

const STEPS = [
  { title: 'Set pickup and drop-off', body: 'Choose where you are and where you’re going. See your pooled and solo price before you book.' },
  { title: 'We match you in seconds', body: 'You join a Tesla heading the same way, with a seat free and at most five minutes of detour.' },
  { title: 'Ride, arrive, pay', body: 'Track every step live. Pay only for your own distance, with the pool discount built in.' },
];

const SAFETY = [
  { icon: Icon.eye, title: 'Your trip stays yours', body: 'Co-riders see how many people share the car, never your name or destination.' },
  { icon: Icon.shield, title: 'Verified drivers', body: 'Every driver is licensed and linked to one registered vehicle.' },
  { icon: Icon.pulse, title: 'Live status', body: 'Matched, arriving, on the way, dropped off: you always know where things stand.' },
  { icon: Icon.leaf, title: 'Zero petrol', body: 'Every car is electric. Sharing one means fewer cars on Dhaka’s roads.' },
];

export default function Landing() {
  const { ready, user } = useSession();
  const router = useRouter();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user.role));
  }, [ready, user, router]);

  return (
    <div className="lp">
      <section className="lp-band lp-hero">
        <div className="lp-inner lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">
              <span className="dot" /> Shared electric rides in Dhaka
            </span>
            <h1>
              One Tesla.
              <br />
              <span className="lp-grad">Three riders.</span>
              <br />
              A lighter fare.
            </h1>
            <p className="lp-bn" lang="bn">
              একসাথে চলুন, কম খরচে পৌঁছান।
            </p>
            <p className="lp-lead">
              Book a seat, get matched with people going your way and pay only for your own distance, with the
              pool discount built in.
            </p>
            <div className="row">
              <Link href="/signup" className="btn lp-btn">
                Create an account
              </Link>
              <Link href="/login?role=driver" className="btn secondary lp-btn">
                Sign in as a Tesla driver
              </Link>
            </div>
            <ul className="lp-facts">
              <li>
                <strong>25%</strong>
                <span>off distance when you share</span>
              </li>
              <li>
                <strong>≤5 min</strong>
                <span>extra time, guaranteed</span>
              </li>
              <li>
                <strong>3</strong>
                <span>seats per Tesla</span>
              </li>
            </ul>
          </div>
          <div className="lp-stage">
            <div className="lp-stage-glow" aria-hidden />
            <CityScene reducedMotion={reduced} />
            <div className="lp-chip lp-chip-a" aria-hidden>
              <span className="lp-chip-dot ok" />
              <div>
                <strong>Pool matched</strong>
                <span>2 riders · 1 seat free</span>
              </div>
            </div>
            <div className="lp-chip lp-chip-b" aria-hidden>
              <span className="lp-chip-dot brand" />
              <div>
                <strong>You save ৳20</strong>
                <span>on a 4 km trip</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-band" id="services">
        <div className="lp-inner">
          <Reveal>
            <header className="lp-head">
              <span className="lp-kicker">What we do</span>
              <h2>Everything you need to move across the city</h2>
            </header>
          </Reveal>
          <div className="lp-services">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <Tilt className={`lp-service ${s.accent ? 'accent' : ''}`}>
                  <span className="lp-icon">{s.icon}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <Link href={s.href} className="lp-more">
                    {s.cta} <span aria-hidden>→</span>
                  </Link>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-band lp-soft" id="how">
        <div className="lp-inner">
          <Reveal>
            <header className="lp-head">
              <span className="lp-kicker">How it works</span>
              <h2>From request to drop-off in three steps</h2>
            </header>
          </Reveal>
          <ol className="lp-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 120}>
                  <span className="lp-step-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-band" id="fares">
        <div className="lp-inner lp-split">
          <Reveal>
            <span className="lp-kicker">Fair by design</span>
            <h2>You pay for your trip. Not for anyone else’s.</h2>
            <p className="lp-lead">
              Every fare is a ৳30 base plus ৳20 per kilometre per seat, counted only from your pickup to your drop-off.
              Share the car and a quarter of the distance charge comes off. If your co-rider cancels, your price is
              recalculated straight away.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="lp-compare" role="img" aria-label="A 4 kilometre trip costs 110 taka solo and 90 taka pooled">
              <div className="lp-compare-head">
                <span>Example: 4 km, 1 seat</span>
              </div>
              <div className="lp-bar-row">
                <span>Solo</span>
                <div className="lp-bar">
                  <i style={{ width: '100%' }} />
                </div>
                <strong>৳110</strong>
              </div>
              <div className="lp-bar-row pooled">
                <span>Pool</span>
                <div className="lp-bar">
                  <i style={{ width: '82%' }} />
                </div>
                <strong>৳90</strong>
              </div>
              <p className="subtle">৳30 base + ৳80 distance, minus 25% of the distance when pooled.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-band lp-soft" id="safety">
        <div className="lp-inner">
          <Reveal>
            <header className="lp-head">
              <span className="lp-kicker">Safety and privacy</span>
              <h2>Sharing a car shouldn’t mean sharing your life</h2>
            </header>
          </Reveal>
          <div className="lp-safety">
            {SAFETY.map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="lp-safe">
                  <span className="lp-icon small">{s.icon}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-band" id="app">
        <div className="lp-inner lp-split">
          <Reveal>
            <div className="lp-phone-stage" aria-hidden>
              <div className="lp-phone">
                <div className="lp-screen">
                  <div className="lp-notch" />
                  <div className="lp-screen-top">
                    <span className="lp-pill">On the way</span>
                    <span className="lp-eta">12 min</span>
                  </div>
                  <div className="lp-route">
                    <span className="p a" />
                    <span className="line" />
                    <span className="p b" />
                  </div>
                  <div className="lp-fare-card">
                    <span>Your fare</span>
                    <strong>৳90</strong>
                    <em>Pool discount −৳20</em>
                  </div>
                  <div className="lp-seatrow">
                    <i className="on" />
                    <i className="on" />
                    <i />
                  </div>
                </div>
              </div>
              <div className="lp-float lp-float-a">
                <strong>Driver arrived</strong>
                <span>White Model 3</span>
              </div>
              <div className="lp-float lp-float-b">
                <strong>TeslaPay</strong>
                <span>Paid at drop-off</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <span className="lp-kicker">Always in the loop</span>
            <h2>Watch your ride come together, live</h2>
            <p className="lp-lead">
              See when you’re matched, when your driver arrives and when you’re dropped off. Your fare updates as
              the pool changes, and every change is kept on your receipt.
            </p>
            <div className="row">
              <Link href="/signup" className="btn lp-btn">
                Create an account
              </Link>
              <Link href="/login" className="btn ghost">
                I already have one
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-band lp-drive">
        <div className="lp-inner lp-drive-grid">
          <Reveal>
            <span className="lp-kicker light">For drivers</span>
            <h2>More riders per trip. More earned per kilometre.</h2>
            <p>
              Go online at your zone, accept requests that fit your car and get a clear stop order for every pool.
              Cash to collect is shown per rider, so drop-offs stay quick.
            </p>
          </Reveal>
          <Reveal delay={120} className="lp-drive-cta">
            <Link href="/login?role=driver" className="btn lp-btn light">
              Start driving
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="lp-band lp-footer">
        <div className="lp-inner lp-foot-grid">
          <div className="stack">
            <span className="brand">
              <span className="brand-mark" aria-hidden>
                T
              </span>
              Oi Tesla Pool
            </span>
            <p className="subtle">Shared electric rides across Dhaka.</p>
          </div>
          <nav aria-label="Ride">
            <h4>Ride</h4>
            <Link href="/signup">Create an account</Link>
            <a href="#fares">Fares</a>
            <a href="#safety">Safety</a>
          </nav>
          <nav aria-label="Drive">
            <h4>Drive</h4>
            <Link href="/login?role=driver">Driver sign-in</Link>
            <a href="#how">How pooling works</a>
          </nav>
          <nav aria-label="Account">
            <h4>Account</h4>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Create account</Link>
          </nav>
        </div>
        <div className="lp-inner lp-copy subtle">© {new Date().getFullYear()} Oi Tesla Pool</div>
      </footer>
    </div>
  );
}
