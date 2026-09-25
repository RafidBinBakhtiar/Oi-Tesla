'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';

const NAV = {
  passenger: [
    { href: '/passenger', label: 'Ride' },
    { href: '/passenger/history', label: 'History' },
  ],
  driver: [
    { href: '/driver', label: 'Dashboard' },
    { href: '/driver/history', label: 'Trips' },
  ],
};

export function AppHeader() {
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="header">
      <div className="container">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            T
          </span>
          Oi Tesla Pool
        </Link>
        {user && (
          <nav className="nav" aria-label="Main">
            {NAV[user.role].map((item) => (
              <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="who">
          {user ? (
            <>
              <span className="name muted">
                {user.name}
                {user.role === 'driver' && user.vehicle ? ` · ${user.vehicle.modelName}` : ''}
              </span>
              <button
                type="button"
                className="btn small secondary"
                onClick={() => {
                  signOut();
                  router.replace('/login');
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn small">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
