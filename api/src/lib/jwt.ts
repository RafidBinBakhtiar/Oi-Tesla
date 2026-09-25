import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type Role = 'passenger' | 'driver';

export interface AuthContext {
  id: string;
  role: Role;
}

interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(ctx: AuthContext): string {
  const payload: TokenPayload = { sub: ctx.id, role: ctx.role };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

/** Returns null for any invalid, expired or tampered token. */
export function verifyToken(token: string): AuthContext | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || decoded === null) return null;
    const { sub, role } = decoded as Partial<TokenPayload>;
    if (typeof sub !== 'string' || (role !== 'passenger' && role !== 'driver')) return null;
    return { id: sub, role };
  } catch {
    return null;
  }
}
