import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

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

  (req.log ?? logger).error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side' } });
};
