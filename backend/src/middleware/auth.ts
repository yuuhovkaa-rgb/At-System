import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { forbidden, unauthorized } from '../utils/errors';
import { verifyAccess } from '../utils/tokens';

export type RoleName = 'ADMIN' | 'MONITOR' | 'STUDENT';
export interface AuthUser { id: string; role: RoleName; fullName: string; email: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

/** Verifies the bearer token and re-loads the user from the DB on every request,
 *  so role changes and deactivation take effect immediately (never trust the token's claims). */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) throw unauthorized();
    let sub: string;
    try { sub = verifyAccess(h.slice(7)).sub; } catch { throw unauthorized('TOKEN_INVALID'); }
    const u = await prisma.user.findUnique({ where: { id: sub }, include: { role: true } });
    if (!u || !u.isActive) throw unauthorized('ACCOUNT_DISABLED');
    req.user = { id: u.id, role: u.role.name, fullName: u.fullName, email: u.email };
    next();
  } catch (e) { next(e); }
}

export const requireRole =
  (...roles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    !req.user ? next(unauthorized()) : roles.includes(req.user.role) ? next() : next(forbidden());
