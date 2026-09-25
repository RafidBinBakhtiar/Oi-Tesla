import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { SessionProvider } from '@/lib/session';
import './globals.css';

// Read PUBLIC_API_URL per request (not at build time), so one Docker image
// works locally, in compose and when deployed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Oi Tesla Pool',
  description: 'Share a seat. Split the fare. Survive Dhaka traffic.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const apiUrl = (process.env.PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  return (
    <html lang="en">
      <body>
        <SessionProvider apiUrl={apiUrl}>
          <AppHeader />
          <main className="container">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
