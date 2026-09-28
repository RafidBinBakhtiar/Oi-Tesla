'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { ApiError, useSession } from '@/lib/session';

interface FieldError {
  path: string;
  message: string;
}

type Role = 'passenger' | 'driver';

export default function SignupPage() {
  const { signUp, signUpDriver } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<Role>('passenger');
  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    password: '',
    licenseNumber: '',
    vehicleModel: '',
    vehiclePlate: '',
    vehicleCapacity: '3',
  });
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
      if (role === 'passenger') {
        await signUp(form.name.trim(), form.phoneNumber.trim(), form.password);
        router.push('/passenger');
      } else {
        await signUpDriver({
          name: form.name.trim(),
          phoneNumber: form.phoneNumber.trim(),
          password: form.password,
          licenseNumber: form.licenseNumber.trim(),
          vehicle: {
            modelName: form.vehicleModel.trim(),
            plateNumber: form.vehiclePlate.trim(),
            capacity: Number(form.vehicleCapacity),
          },
        });
        router.push('/driver');
      }
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
        <h1>Create an account</h1>

        {/* Role radio toggle */}
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="radio"
              name="role"
              value="passenger"
              checked={role === 'passenger'}
              onChange={() => setRole('passenger')}
            />
            Passenger
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="radio"
              name="role"
              value="driver"
              checked={role === 'driver'}
              onChange={() => setRole('driver')}
            />
            Driver
          </label>
        </div>

        {/* Common fields */}
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

        {/* Driver-only fields */}
        {role === 'driver' && (
          <>
            <label className="field">
              Driving license number
              <input
                value={form.licenseNumber}
                onChange={set('licenseNumber')}
                placeholder="e.g. DL-1234567"
                required
              />
              {fieldError('licenseNumber')}
            </label>
            <label className="field">
              Vehicle model
              <input
                value={form.vehicleModel}
                onChange={set('vehicleModel')}
                placeholder="e.g. Tesla Model 3"
                required
              />
              {fieldError('vehicle.modelName')}
            </label>
            <label className="field">
              Vehicle plate number
              <input
                value={form.vehiclePlate}
                onChange={set('vehiclePlate')}
                placeholder="e.g. Dhaka Metro-GA 11-0001"
                required
              />
              {fieldError('vehicle.plateNumber')}
            </label>
            <label className="field">
              Passenger capacity (seats)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={8}
                value={form.vehicleCapacity}
                onChange={set('vehicleCapacity')}
                required
              />
              {fieldError('vehicle.capacity')}
            </label>
          </>
        )}

        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <button className="btn block" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
        <p className="subtle">
          {role === 'passenger'
            ? 'New accounts start with an empty TeslaPay wallet, so pay cash. '
            : 'You can go online immediately after signing up. '}
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
