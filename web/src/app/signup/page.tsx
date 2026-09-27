'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { ApiError, useSession } from '@/lib/session';

interface FieldError {
  path: string;
  message: string;
}

export default function SignupPage() {
  const { signUp } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phoneNumber: '', password: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      await signUp(form.name.trim(), form.phoneNumber.trim(), form.password);
      router.push('/passenger');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        setFieldErrors(Object.fromEntries((err.details as FieldError[]).map((d) => [d.path, d.message])));
      } else {
        setError(err instanceof ApiError ? err.message : 'Sign-up failed');
      }
      setPending(false);
    }
  }

  const fieldError = (key: string) =>
    fieldErrors[key] && (
      <span className="hint" style={{ color: 'var(--danger)' }}>
        {fieldErrors[key]}
      </span>
    );

  return (
    <div className="page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Create a passenger account</h1>
        <label className="field">
          Name
          <input autoComplete="name" value={form.name} onChange={set('name')} placeholder="Your name" required />
          {fieldError('name')}
        </label>
        <label className="field">
          Mobile number
          <input
            inputMode="numeric"
            autoComplete="tel"
            value={form.phoneNumber}
            onChange={set('phoneNumber')}
            placeholder="01XXXXXXXXX"
            required
          />
          {fieldError('phoneNumber')}
        </label>
        <label className="field">
          Password <span className="hint">At least 8 characters</span>
          <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
          {fieldError('password')}
        </label>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <button className="btn block" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
        <p className="subtle">
          New accounts start with an empty TeslaPay wallet, so pay cash. Already registered?{' '}
          <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
