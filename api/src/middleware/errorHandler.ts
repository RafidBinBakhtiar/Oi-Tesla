import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/** Pulls the SQLSTATE and constraint name out of a Prisma raw-query error message. */
function extractSqlState(err: unknown): string | undefined {
  const msg = (err as { message?: string })?.message ?? '';
  // Quotes arrive backslash-escaped inside Prisma's Rust error string.
  return /code:\s*\\?"(\d{5})\\?"/.exec(msg)?.[1];
}

function extractConstraint(err: unknown): string | undefined {
  const msg = (err as { message?: string })?.message ?? '';
  return /constraint\s+\\?"([\w".]+?)\\?"/i.exec(msg)?.[1];
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Malformed JSON bodies from express.json()
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }

  const prismaCode: string | undefined = err?.code;
  if (prismaCode === 'P2002') {
    // Unique constraint violation surfaced by the database — e.g. a second active
    // ride for the same passenger, or a second active pool for the same Tesla.
    res.status(409).json({ error: { code: 'CONFLICT', message: 'That would violate a uniqueness rule' } });
    return;
  }
  if (prismaCode === 'P2034' || prismaCode === '40P01') {
    res.status(409).json({ error: { code: 'RETRY', message: 'Concurrent update detected, please retry' } });
    return;
  }

  // Postgres integrity-constraint violations (SQLSTATE class 23) surface through
  // Prisma raw queries as unknown errors, so without this they become opaque
  // 500s. Naming the constraint turns them into an actionable 422.
  const pgState: string | undefined = err?.meta?.code ?? extractSqlState(err);
  if (pgState?.startsWith('23')) {
    const constraint = extractConstraint(err);
    (req.log ?? logger).error({ err, constraint }, 'database constraint violation');
    res.status(422).json({
      error: {
        code: 'CONSTRAINT_VIOLATION',
        message: 'This action would break a data rule',
        details: constraint ? { constraint } : undefined,
      },
    });
    return;
  }

  (req.log ?? logger).error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side' } });
};
