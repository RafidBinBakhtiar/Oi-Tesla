'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CAST, DEMO_PASSWORD } from '@/lib/cast';
import { ApiError, homeFor, useSession } from '@/lib/session';
import type { Role } from '@/lib/types';

/** One-tap sign-in as a member of the story cast. */
export function CastPicker({ role }: { role?: Role }) {
  const { signIn } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const people = role ? CAST.filter((c) => c.role === role) : CAST;

  async function pick(name: string) {
    const person = CAST.find((c) => c.name === name)!;
    setBusy(name);
    setError(null);
    try {
      await signIn(person.role, person.phoneNumber, DEMO_PASSWORD);
      router.push(homeFor(person.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed');
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className="cast">
        {people.map((p) => (
          <button
            key={p.name}
            type="button"
            className="btn secondary"
            style={{ justifyContent: 'flex-start' }}
            onClick={() => pick(p.name)}
            disabled={busy !== null}
          >
            <span className="avatar" aria-hidden>
              {p.name[0]}
            </span>
            <span style={{ display: 'grid' }}>
              <span>
                {busy === p.name ? 'Signing in…' : p.name}{' '}
                <span className="subtle">· {p.role}</span>
              </span>
              <span className="subtle" style={{ fontWeight: 400 }}>
                {p.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
