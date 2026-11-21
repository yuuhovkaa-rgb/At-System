import { NextFunction, Request, RequestHandler, Response } from 'express';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
}
export const badRequest = (code = 'BAD_REQUEST', d?: unknown) => new ApiError(400, code, code, d);
export const unauthorized = (code = 'UNAUTHORIZED') => new ApiError(401, code);
export const forbidden = (code = 'FORBIDDEN') => new ApiError(403, code);
export const notFound = (code = 'NOT_FOUND') => new ApiError(404, code);
export const conflict = (code = 'CONFLICT', d?: unknown) => new ApiError(409, code, code, d);

/** Wraps async handlers so rejected promises reach the error middleware (Express 4). */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
