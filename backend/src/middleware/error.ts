import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors';
import { isProd } from '../config/env';

/** Consistent error body: { error: { code, message, details? } } */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError)
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  if (err instanceof ZodError)
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
    });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Already exists', details: err.meta } });
    if (err.code === 'P2003') return res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'Referenced record does not exist' } });
    if (err.code === 'P2025') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  if ((err as { name?: string })?.name === 'MulterError') return res.status(400).json({ error: { code: 'FILE_INVALID', message: (err as Error).message } });
  if ((err as { type?: string })?.type === 'entity.parse.failed')
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: isProd ? 'Internal server error' : String((err as Error)?.message) } });
}
