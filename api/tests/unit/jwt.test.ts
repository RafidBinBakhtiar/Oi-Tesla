import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../../src/lib/jwt';

describe('jwt', () => {
  it('round-trips id and role', () => {
    const token = signToken({ id: 'nusrat-id', role: 'passenger' });
    expect(verifyToken(token)).toEqual({ id: 'nusrat-id', role: 'passenger' });
  });

  it('rejects tokens signed with another secret', () => {
    const token = jwt.sign({ sub: 'x', role: 'driver' }, 'some-other-secret-value');
    expect(verifyToken(token)).toBeNull();
  });

  it('rejects the "none" algorithm', () => {
    const token = jwt.sign({ sub: 'x', role: 'driver' }, '', { algorithm: 'none' });
    expect(verifyToken(token)).toBeNull();
  });

  it('rejects tokens with an unknown role', () => {
    const token = jwt.sign({ sub: 'x', role: 'admin' }, process.env.JWT_SECRET!);
    expect(verifyToken(token)).toBeNull();
  });
});
