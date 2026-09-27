'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { ApiError, homeFor, useSession } from '@/lib/session';
import type { Role } from '@/lib/types';

export default function LoginPage() {
  const { signIn, user, ready } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<Role>('passenger');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('role');
    if (wanted === 'driver' || wanted === 'passenger') setRole(wanted);
  }, []);

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user.role));
  }, [ready, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const u = await signIn(role, phoneNumber.trim(), password);
      router.push(homeFor(u.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed');
      setPending(false);
    }
  }

  return (
    <div className="page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <div className="spread">
          <h1>Sign in</h1>
          <div className="segmented" role="group" aria-label="Account type">
            {(['passenger', 'driver'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>
                {r === 'passenger' ? 'Passenger' : 'Driver'}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          Mobile number
          <input
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <button className="btn block" disabled={pending || !phoneNumber || !password}>
          {pending ? 'Signing in…' : `Sign in as ${role}`}
        </button>
        {role === 'passenger' && (
          <p className="subtle">
            New here? <Link href="/signup">Create a passenger account</Link>
          </p>
        )}
      </form>
    </div>
  );
}
