import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../config/db';
import { env, isProd, isTest } from '../config/env';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../utils/audit';
import { ApiError, unauthorized, wrap } from '../utils/errors';
import { notify } from '../utils/notify';
import { randomToken, sha256, signAccess, signRefresh, verifyRefresh } from '../utils/tokens';
import { email, password } from '../validators/common';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, skip: () => isTest,
  standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' } } });

const COOKIE = 'refresh_token';
const cookieOpts = { httpOnly: true, sameSite: 'strict' as const, secure: isProd, path: '/api/auth', maxAge: 7 * 864e5 };
// Pre-computed hash so unknown e-mails cost the same time as wrong passwords.
let dummyHash: string | undefined;

export const publicUser = (u: any) => ({
  id: u.id, email: u.email, fullName: u.fullName, role: u.role.name, isActive: u.isActive,
  language: u.language, theme: u.theme,
  studentId: u.student?.id ?? null, studentCode: u.student?.studentCode ?? null,
  classId: u.monitor?.classId ?? null,
  permissions: u.monitor ? { canPublishAnnouncements: u.monitor.canPublishAnnouncements,
    canExportReports: u.monitor.canExportReports, canRequestCorrections: u.monitor.canRequestCorrections } : null,
});
const include = { role: true, student: true, monitor: true } as const;

async function issue(userId: string, res: any) {
  const refresh = signRefresh(userId);
  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: sha256(refresh), lastLoginAt: new Date() } });
  res.cookie(COOKIE, refresh, cookieOpts);
  return signAccess(userId);
}

authRouter.post('/login', limiter, validate(z.object({ email, password: z.string().min(1).max(100) })), wrap(async (req, res) => {
  const { email: mail, password: pw } = req.body;
  const user = await prisma.user.findUnique({ where: { email: mail }, include });
  dummyHash ??= await argon2.hash('dummy-password-1');
  const ok = await argon2.verify(user?.passwordHash ?? dummyHash, pw).catch(() => false);
  if (!user || !ok) {
    await audit(user?.id ?? null, 'LOGIN_FAILED', 'User', user?.id, null, { email: mail }, req);
    throw unauthorized('INVALID_CREDENTIALS');
  }
  if (!user.isActive) {
    await audit(user.id, 'LOGIN_BLOCKED', 'User', user.id, null, null, req);
    throw new ApiError(403, 'ACCOUNT_DISABLED');
  }
  const accessToken = await issue(user.id, res);
  await audit(user.id, 'LOGIN', 'User', user.id, null, null, req);
  res.json({ accessToken, user: publicUser(user) });
}));

authRouter.post('/refresh', limiter, wrap(async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw unauthorized('NO_REFRESH_TOKEN');
  let sub: string;
  try { sub = verifyRefresh(token).sub; } catch { throw unauthorized('REFRESH_INVALID'); }
  const user = await prisma.user.findUnique({ where: { id: sub }, include });
  if (!user || !user.isActive || user.refreshTokenHash !== sha256(token)) throw unauthorized('REFRESH_INVALID');
  const accessToken = await issue(user.id, res); // rotation: old refresh token stops working
  res.json({ accessToken, user: publicUser(user) });
}));

authRouter.post('/logout', wrap(async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try { await prisma.user.updateMany({ where: { id: verifyRefresh(token).sub }, data: { refreshTokenHash: null } }); } catch { /* ignore */ }
  }
  res.clearCookie(COOKIE, { path: '/api/auth' });
  res.json({ ok: true });
}));

authRouter.get('/me', authenticate, wrap(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include });
  res.json({ user: publicUser(user) });
}));

authRouter.patch('/me', authenticate, validate(z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  language: z.enum(['en', 'kh']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
})), wrap(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: req.body, include });
  res.json({ user: publicUser(user) });
}));

authRouter.post('/change-password', authenticate, validate(z.object({ currentPassword: z.string().min(1), newPassword: password })), wrap(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await argon2.verify(user.passwordHash, req.body.currentPassword))) throw new ApiError(400, 'CURRENT_PASSWORD_WRONG');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(req.body.newPassword), refreshTokenHash: null } });
  await audit(user.id, 'PASSWORD_CHANGED', 'User', user.id, null, null, req);
  await notify([user.id], 'password_changed');
  res.clearCookie(COOKIE, { path: '/api/auth' });
  res.json({ ok: true });
}));

// Always answers 200 so the endpoint cannot be used to discover which e-mails exist.
authRouter.post('/forgot-password', limiter, validate(z.object({ email })), wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (user?.isActive) {
    const token = randomToken();
    await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + 3600_000) } });
    await audit(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id, null, null, req);
    // No SMTP is bundled: the link is printed to the server log in non-production. See docs/system-overview.md.
    if (!isProd) console.log(`[password reset] ${user.email}: ${env.APP_URL}/reset-password?token=${token}`);
  }
  res.json({ ok: true });
}));

authRouter.post('/reset-password', limiter, validate(z.object({ token: z.string().min(10).max(200), newPassword: password })), wrap(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { resetTokenHash: sha256(req.body.token), resetTokenExpires: { gt: new Date() } } });
  if (!user) throw new ApiError(400, 'RESET_TOKEN_INVALID');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(req.body.newPassword),
    resetTokenHash: null, resetTokenExpires: null, refreshTokenHash: null } });
  await audit(user.id, 'PASSWORD_RESET', 'User', user.id, null, null, req);
  await notify([user.id], 'password_changed');
  res.json({ ok: true });
}));
