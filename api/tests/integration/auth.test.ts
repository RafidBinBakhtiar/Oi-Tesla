import { beforeAll, describe, expect, it } from 'vitest';
import { signToken } from '../../src/lib/jwt';
import { api, bearer, FIXTURE_PASSWORD, login, resetDatabase } from './helpers';

describe('auth', () => {
  beforeAll(resetDatabase);

  it('reports a healthy database', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('up');
  });

  it('lets a new passenger sign up and use the token', async () => {
    const signup = await api()
      .post('/api/auth/passengers/signup')
      .send({ name: 'Tania', phoneNumber: '01911000009', password: 'banani-rocks' });
    expect(signup.status).toBe(201);
    expect(signup.body.user).toMatchObject({ name: 'Tania', role: 'passenger', walletBalancePaisa: 0 });
    expect(signup.body.user.passwordHash).toBeUndefined();

    const me = await api().get('/api/auth/me').set(bearer(signup.body.token));
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('Tania');
  });

  it('rejects a duplicate phone number', async () => {
    const res = await api()
      .post('/api/auth/passengers/signup')
      .send({ name: 'Impostor', phoneNumber: '01711000001', password: 'whatever123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('validates signup input', async () => {
    const res = await api()
      .post('/api/auth/passengers/signup')
      .send({ name: 'N', phoneNumber: '12345', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['name', 'phoneNumber', 'password']),
    );
  });

  it('logs in RiderA and returns the same error for wrong password and unknown phone', async () => {
    expect(await login('RiderA')).toBeTruthy();

    const wrongPassword = await api()
      .post('/api/auth/passengers/login')
      .send({ phoneNumber: '01711000001', password: 'not-her-password' });
    const unknownPhone = await api()
      .post('/api/auth/passengers/login')
      .send({ phoneNumber: '01799999999', password: 'not-her-password' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownPhone.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownPhone.body);
  });

  it('logs DriverA in as a driver with their car attached', async () => {
    const token = await login('DriverA');
    const me = await api().get('/api/auth/me').set(bearer(token));
    expect(me.body).toMatchObject({
      role: 'driver',
      name: 'DriverA',
      vehicle: { modelName: 'Tesla Model 3', capacity: 3 },
    });
  });

  it('does not let a passenger log in through the driver endpoint', async () => {
    const res = await api()
      .post('/api/auth/drivers/login')
      .send({ phoneNumber: '01711000001', password: FIXTURE_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects missing, forged and expired tokens', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(bearer('not.a.jwt'))).status).toBe(401);

    const forged = signToken({ id: '00000000-0000-0000-0000-000000000000', role: 'passenger' }).replace(
      /\.[^.]+$/,
      '.tampered',
    );
    expect((await api().get('/api/auth/me').set(bearer(forged))).status).toBe(401);
  });
});
