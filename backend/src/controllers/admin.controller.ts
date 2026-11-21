import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { monitorProfile } from '../services/access';
import { rulesOf, statsFor } from '../services/attendanceStats';
import { buildReport } from '../services/reports';
import { audit } from '../utils/audit';
import { ApiError, conflict, notFound, wrap } from '../utils/errors';
import { notify } from '../utils/notify';
import { pageMeta, pageQuery, paginate } from '../utils/pagination';
import { getSettings, saveSettings } from '../utils/settings';
import { attendanceStats, countStatuses } from '../utils/stats';
import { dateOnly, dayjs, todayIn, ymd } from '../utils/time';
import { randomPassword } from '../utils/tokens';
import { email, id, password, ymdDate } from '../validators/common';

export const adminRouter = Router();
export const settingsRouter = Router();
export const academicRouter = Router();
export const monitorDashRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));
settingsRouter.use(authenticate);
academicRouter.use(authenticate);
monitorDashRouter.use(authenticate, requireRole('MONITOR'));

// ---------- dashboards ----------
adminRouter.get('/dashboard', wrap(async (_req, res) => {
  const s = await getSettings(); const rules = rulesOf(s); const today = todayIn(s.timezone);
  const [students, monitors, classes, todayRecs, overall] = await Promise.all([
    prisma.student.count({ where: { user: { isActive: true } } }),
    prisma.classMonitor.count({ where: { user: { isActive: true } } }),
    prisma.class.count({ where: { archived: false } }),
    prisma.attendanceRecord.findMany({ where: { session: { date: dateOnly(today) } }, select: { status: true } }),
    statsFor({}),
  ]);
  const rep = await buildReport(_req.user!, { from: dayjs(today).subtract(13, 'day').format('YYYY-MM-DD'), to: today });
  res.json({ date: today, totals: { students, monitors, classes }, today: attendanceStats(countStatuses(todayRecs.map((r) => r.status)), rules),
    overall, trend: rep!.trend, classes: rep!.classes });
}));

adminRouter.get('/analytics', validate(z.object({ from: ymdDate.optional(), to: ymdDate.optional(), classId: id.optional(), semesterId: id.optional(), academicYearId: id.optional() }), 'query'), wrap(async (req, res) => {
  const r = await buildReport(req.user!, { ...(req.query as any), from: (req.query as any).from ?? dayjs().subtract(6, 'month').format('YYYY-MM-DD'), period: 'month' });
  const { rows: _rows, ...rest } = r!;
  res.json({ ...rest, topAbsent: [...r!.students].sort((a, b) => b.absent - a.absent).slice(0, 10), atRisk: r!.students.filter((s) => s.atRisk) });
}));

monitorDashRouter.get('/dashboard', wrap(async (req, res) => {
  const m = await monitorProfile(req.user!.id); const s = await getSettings(); const today = todayIn(s.timezone);
  const [cls, studentCount, todayRecs, recent, pending, overall] = await Promise.all([
    prisma.class.findUniqueOrThrow({ where: { id: m.classId } }),
    prisma.classStudent.count({ where: { classId: m.classId, student: { user: { isActive: true } } } }),
    prisma.attendanceRecord.findMany({ where: { session: { classId: m.classId, date: dateOnly(today) } }, select: { status: true } }),
    prisma.attendanceSession.findMany({ where: { classId: m.classId }, orderBy: [{ date: 'desc' }, { sessionNo: 'desc' }], take: 6 }),
    prisma.attendanceCorrectionRequest.count({ where: { status: 'PENDING', record: { session: { classId: m.classId } } } }),
    statsFor({ session: { classId: m.classId } }),
  ]);
  const rec = await prisma.attendanceRecord.findMany({ where: { sessionId: { in: recent.map((r) => r.id) } }, select: { sessionId: true, status: true } });
  res.json({ class: { id: cls.id, name: cls.name, code: cls.code }, date: today, studentCount, today: attendanceStats(countStatuses(todayRecs.map((r) => r.status)), rulesOf(s)), overall, pendingCorrections: pending,
    recent: recent.map((x) => ({ id: x.id, date: ymd(x.date), sessionNo: x.sessionNo, status: x.status, counts: countStatuses(rec.filter((r) => r.sessionId === x.id).map((r) => r.status)) })) });
}));

// ---------- users ----------
const uInclude = { role: true } as const;
const uView = (u: any) => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role.name, isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt });

adminRouter.get('/users', validate(pageQuery.extend({ role: z.enum(['ADMIN', 'MONITOR', 'STUDENT']).optional(), active: z.enum(['true', 'false']).optional() }), 'query'), wrap(async (req, res) => {
  const q = req.query as any;
  const where: Prisma.UserWhereInput = { ...(q.role ? { role: { name: q.role } } : {}), ...(q.active ? { isActive: q.active === 'true' } : {}),
    ...(q.q ? { OR: [{ fullName: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] } : {}) };
  const [total, items] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({ where, include: uInclude, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) })]);
  res.json({ items: items.map(uView), ...pageMeta(q.page, q.pageSize, total) });
}));
adminRouter.post('/users', validate(z.object({ fullName: z.string().trim().min(2).max(100), email, password: password.optional() })), wrap(async (req, res) => {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const temp = req.body.password ?? randomPassword();
  const u = await prisma.user.create({ data: { fullName: req.body.fullName, email: req.body.email, roleId: role.id, passwordHash: await argon2.hash(temp) }, include: uInclude });
  await audit(req.user, 'CREATE_ADMIN', 'User', u.id, null, { email: u.email }, req);
  res.status(201).json({ user: uView(u), temporaryPassword: req.body.password ? undefined : temp });
}));
adminRouter.patch('/users/:id', validate(z.object({ isActive: z.boolean() })), wrap(async (req, res) => {
  if (req.params.id === req.user!.id) throw new ApiError(400, 'CANNOT_MODIFY_SELF');
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: req.body.isActive, ...(req.body.isActive ? {} : { refreshTokenHash: null }) }, include: uInclude });
  await audit(req.user, req.body.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'User', u.id, null, { isActive: u.isActive }, req);
  res.json({ user: uView(u) });
}));
// Role changes need the matching profile (student / monitor row) to exist, otherwise the account could not work.
adminRouter.put('/users/:id/role', validate(z.object({ role: z.enum(['ADMIN', 'MONITOR', 'STUDENT']) })), wrap(async (req, res) => {
  if (req.params.id === req.user!.id) throw new ApiError(400, 'CANNOT_MODIFY_SELF');
  const u = await prisma.user.findUnique({ where: { id: req.params.id }, include: { role: true, student: true, monitor: true } });
  if (!u) throw notFound();
  if (req.body.role === 'MONITOR' && !u.monitor) throw conflict('MISSING_MONITOR_PROFILE');
  if (req.body.role === 'STUDENT' && !u.student) throw conflict('MISSING_STUDENT_PROFILE');
  const role = await prisma.role.findUniqueOrThrow({ where: { name: req.body.role } });
  const upd = await prisma.user.update({ where: { id: u.id }, data: { roleId: role.id, refreshTokenHash: null }, include: uInclude });
  await audit(req.user, 'CHANGE_ROLE', 'User', u.id, { role: u.role.name }, { role: req.body.role }, req);
  res.json({ user: uView(upd) });
}));
adminRouter.post('/users/:id/reset-password', validate(z.object({ newPassword: password.optional() })), wrap(async (req, res) => {
  const temp = req.body.newPassword ?? randomPassword();
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await argon2.hash(temp), refreshTokenHash: null, resetTokenHash: null, resetTokenExpires: null } });
  await audit(req.user, 'ADMIN_RESET_PASSWORD', 'User', u.id, null, null, req);
  await notify([u.id], 'password_changed');
  res.json({ temporaryPassword: req.body.newPassword ? undefined : temp });
}));

// ---------- audit logs ----------
adminRouter.get('/audit-logs', validate(pageQuery.extend({ action: z.string().max(60).optional(), entity: z.string().max(60).optional(), userId: id.optional(), from: ymdDate.optional(), to: ymdDate.optional() }), 'query'), wrap(async (req, res) => {
  const q = req.query as any;
  const where: Prisma.AuditLogWhereInput = { ...(q.action ? { action: { contains: q.action, mode: 'insensitive' } } : {}), ...(q.entity ? { entity: q.entity } : {}), ...(q.userId ? { userId: q.userId } : {}),
    ...((q.from || q.to) ? { createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59Z`) } : {}) } } : {}) };
  const [total, items] = await Promise.all([prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) })]);
  res.json({ items: items.map((l) => ({ id: l.id, action: l.action, entity: l.entity, entityId: l.entityId, before: l.before, after: l.after, ip: l.ip, createdAt: l.createdAt, user: l.user?.fullName ?? null, userEmail: l.user?.email ?? null })), ...pageMeta(q.page, q.pageSize, total) });
}));

// ---------- settings ----------
settingsRouter.get('/', wrap(async (_req, res) => res.json({ settings: await getSettings() })));
settingsRouter.put('/', requireRole('ADMIN'), validate(z.object({
  schoolName: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'INVALID_TIMEZONE').optional(),
  excusedPolicy: z.enum(['EXCLUDE', 'COUNT_AS_PRESENT', 'COUNT_AS_ABSENT']).optional(),
  lateCountsAsPresent: z.boolean().optional(), lateAfterMinutes: z.number().int().min(0).max(240).optional(),
  minAttendancePercent: z.number().min(0).max(100).optional(),
}).strict()), wrap(async (req, res) => {
  const before = await getSettings();
  await saveSettings(req.body);
  await audit(req.user, 'UPDATE_SETTINGS', 'SystemSetting', null, before as never, req.body, req);
  res.json({ settings: await getSettings() });
}));

// ---------- academic years & semesters (read: any signed-in user; write: admin) ----------
const years = z.object({ name: z.string().trim().min(2).max(60), startDate: ymdDate, endDate: ymdDate, isCurrent: z.boolean().default(false) }).refine((v) => v.startDate < v.endDate, { message: 'END_BEFORE_START', path: ['endDate'] });
const sems = years.and(z.object({ academicYearId: id }));
const d = (v: any) => ({ ...v, startDate: dateOnly(v.startDate), endDate: dateOnly(v.endDate) });
const yView = (y: any) => ({ id: y.id, name: y.name, startDate: ymd(y.startDate), endDate: ymd(y.endDate), isCurrent: y.isCurrent,
  semesters: (y.semesters ?? []).map((s: any) => ({ id: s.id, name: s.name, academicYearId: s.academicYearId, startDate: ymd(s.startDate), endDate: ymd(s.endDate), isCurrent: s.isCurrent })) });

academicRouter.get('/', wrap(async (_req, res) => res.json({ items: (await prisma.academicYear.findMany({ include: { semesters: { orderBy: { startDate: 'asc' } } }, orderBy: { startDate: 'desc' } })).map(yView) })));
academicRouter.post('/', requireRole('ADMIN'), validate(years), wrap(async (req, res) => {
  if (req.body.isCurrent) await prisma.academicYear.updateMany({ data: { isCurrent: false } });
  const y = await prisma.academicYear.create({ data: d(req.body), include: { semesters: true } });
  await audit(req.user, 'CREATE_ACADEMIC_YEAR', 'AcademicYear', y.id, null, req.body, req); res.status(201).json({ item: yView(y) });
}));
academicRouter.put('/:id', requireRole('ADMIN'), validate(years), wrap(async (req, res) => {
  if (req.body.isCurrent) await prisma.academicYear.updateMany({ data: { isCurrent: false } });
  const y = await prisma.academicYear.update({ where: { id: req.params.id }, data: d(req.body), include: { semesters: true } });
  await audit(req.user, 'UPDATE_ACADEMIC_YEAR', 'AcademicYear', y.id, null, req.body, req); res.json({ item: yView(y) });
}));
academicRouter.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  if (await prisma.class.count({ where: { academicYearId: req.params.id } })) throw conflict('YEAR_IN_USE');
  await prisma.academicYear.delete({ where: { id: req.params.id } });
  await audit(req.user, 'DELETE_ACADEMIC_YEAR', 'AcademicYear', req.params.id, null, null, req); res.json({ ok: true });
}));
academicRouter.post('/semesters', requireRole('ADMIN'), validate(sems), wrap(async (req, res) => {
  if (req.body.isCurrent) await prisma.semester.updateMany({ data: { isCurrent: false } });
  const s = await prisma.semester.create({ data: d(req.body) });
  await audit(req.user, 'CREATE_SEMESTER', 'Semester', s.id, null, req.body, req); res.status(201).json({ item: s });
}));
academicRouter.put('/semesters/:id', requireRole('ADMIN'), validate(sems), wrap(async (req, res) => {
  if (req.body.isCurrent) await prisma.semester.updateMany({ data: { isCurrent: false } });
  const s = await prisma.semester.update({ where: { id: req.params.id }, data: d(req.body) });
  await audit(req.user, 'UPDATE_SEMESTER', 'Semester', s.id, null, req.body, req); res.json({ item: s });
}));
academicRouter.delete('/semesters/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  if (await prisma.class.count({ where: { semesterId: req.params.id } })) throw conflict('SEMESTER_IN_USE');
  await prisma.semester.delete({ where: { id: req.params.id } });
  await audit(req.user, 'DELETE_SEMESTER', 'Semester', req.params.id, null, null, req); res.json({ ok: true });
}));
