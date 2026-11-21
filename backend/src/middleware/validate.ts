import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req[source]);
    if (!r.success) return next(r.error);
    (req as unknown as Record<string, unknown>)[source] = r.data;
    next();
  };
