'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { homeFor, useSession } from '@/lib/session';
import type { Role } from '@/lib/types';
import { Loading } from './States';

/**
 * Client-side routing guard. It only decides what to render — the API is the
 * real security boundary and rejects the wrong role regardless.
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { ready, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?role=${role}`);
    else if (user.role !== role) router.replace(homeFor(user.role));
  }, [ready, user, role, router]);

  if (!ready || !user || user.role !== role) return <Loading label="Checking your session…" />;
  return <>{children}</>;
}
