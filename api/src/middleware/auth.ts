import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { type AuthContext, type Role, verifyToken } from '../lib/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Requires a valid Bearer token whose role is one of `roles`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const ctx = token ? verifyToken(token) : null;
    if (!ctx) return next(unauthorized());
    if (!roles.includes(ctx.role)) return next(forbidden(`This endpoint is for ${roles.join(' / ')} accounts`));
    req.auth = ctx;
    next();
  };
}

/** Narrowing helper for handlers mounted behind requireRole. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
