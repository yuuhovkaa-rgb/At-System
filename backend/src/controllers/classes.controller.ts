import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { assertClassAccess, visibleClassIds } from '../services/access';
import { audit } from '../utils/audit';
import { ApiError, conflict, notFound, wrap } from '../utils/errors';
import { pageMeta, pageQuery, paginate } from '../utils/pagination';
import { randomPassword } from '../utils/tokens';
import { email, hhmm, id, password } from '../validators/common';

export const classesRouter = Router();
export const monitorsRouter = Router();
classesRouter.use(authenticate);
monitorsRouter.use(authenticate, requireRole('ADMIN'));

const classBody = z.object({
  code: z.string().trim().min(2).max(30), name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullish(), academicYearId: id, semesterId: id.nullish(),
});
const cInclude = { academicYear: true, semester: true, _count: { select: { students: true } },
  monitors: { include: { user: { select: { fullName: true, email: true, isActive: true } } } } } as const;
const flatClass = (c: any) => ({ id: c.id, code: c.code, name: c.name, description: c.description, archived: c.archived,
  academicYear: c.academicYear && { id: c.academicYear.id, name: c.academicYear.name },
  semester: c.semester && { id: c.semester.id, name: c.semester.name }, studentCount: c._count.students,
  monitors: c.monitors.map((m: any) => ({ id: m.id, userId: m.userId, fullName: m.user.fullName, email: m.user.email })) });

classesRouter.get('/', validate(pageQuery.extend({ archived: z.enum(['true', 'false']).default('false') }), 'query'), wrap(async (req, res) => {
  const q = req.query as any;
  if (req.user!.role === 'STUDENT') throw new ApiError(403, 'FORBIDDEN');
  const ids = await visibleClassIds(req.user!);
  const where = { archived: q.archived === 'true', ...(ids ? { id: { in: ids } } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' as const } }, { code: { contains: q.q, mode: 'insensitive' as const } }] } : {}) };
  const [total, items] = await Promise.all([prisma.class.count({ where }),
    prisma.class.findMany({ where, include: cInclude, orderBy: { name: q.order }, ...paginate(q.page, q.pageSize) })]);
  res.json({ items: items.map(flatClass), ...pageMeta(q.page, q.pageSize, total) });
}));

classesRouter.get('/:id', wrap(async (req, res) => {
  await assertClassAccess(req.user!, req.params.id);
  const c = await prisma.class.findUnique({ where: { id: req.params.id }, include: { ...cInclude,
    students: { include: { student: { include: { user: { select: { fullName: true, email: true, isActive: true } } } } }, orderBy: { student: { studentCode: 'asc' } } },
    schedule: { orderBy: [{ dayOfWeek: 'asc' }, { sessionNo: 'asc' }] } } });
  if (!c) throw notFound();
  res.json({ class: { ...flatClass(c), students: c.students.map((s) => ({ id: s.student.id, studentCode: s.student.studentCode, fullName: s.student.user.fullName, email: s.student.user.email, isActive: s.student.user.isActive })), schedule: c.schedule } });
}));

classesRouter.post('/', requireRole('ADMIN'), validate(classBody), wrap(async (req, res) => {
  const c = await prisma.class.create({ data: req.body, include: cInclude });
  await audit(req.user, 'CREATE_CLASS', 'Class', c.id, null, { code: c.code, name: c.name }, req);
  res.status(201).json({ class: flatClass(c) });
}));

classesRouter.put('/:id', requireRole('ADMIN'), validate(classBody.extend({ archived: z.boolean().optional() })), wrap(async (req, res) => {
  const old = await prisma.class.findUnique({ where: { id: req.params.id } });
  if (!old) throw notFound();
  const c = await prisma.class.update({ where: { id: old.id }, data: req.body, include: cInclude });
  await audit(req.user, 'UPDATE_CLASS', 'Class', c.id, { code: old.code, name: old.name, archived: old.archived }, { code: c.code, name: c.name, archived: c.archived }, req);
  res.json({ class: flatClass(c) });
}));

// Archives by default; ?permanent=true only when the class never had attendance sessions.
classesRouter.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const c = await prisma.class.findUnique({ where: { id: req.params.id } });
  if (!c) throw notFound();
  if (req.query.permanent === 'true') {
    if (await prisma.attendanceSession.count({ where: { classId: c.id } }) || await prisma.classMonitor.count({ where: { classId: c.id } })) throw conflict('CLASS_IN_USE');
    await prisma.class.delete({ where: { id: c.id } });
    await audit(req.user, 'DELETE_CLASS', 'Class', c.id, { code: c.code }, null, req);
  } else {
    await prisma.class.update({ where: { id: c.id }, data: { archived: true } });
    await audit(req.user, 'ARCHIVE_CLASS', 'Class', c.id, { archived: false }, { archived: true }, req);
  }
  res.json({ ok: true });
}));

classesRouter.post('/:id/students', requireRole('ADMIN'), validate(z.object({ studentIds: z.array(id).min(1).max(500) })), wrap(async (req, res) => {
  const r = await prisma.classStudent.createMany({ data: req.body.studentIds.map((studentId: string) => ({ classId: req.params.id, studentId })), skipDuplicates: true });
  await audit(req.user, 'ASSIGN_STUDENTS', 'Class', req.params.id, null, { added: r.count }, req);
  res.json({ added: r.count });
}));
classesRouter.delete('/:id/students/:studentId', requireRole('ADMIN'), wrap(async (req, res) => {
  await prisma.classStudent.deleteMany({ where: { classId: req.params.id, studentId: req.params.studentId } });
  await audit(req.user, 'REMOVE_STUDENT_FROM_CLASS', 'Class', req.params.id, { studentId: req.params.studentId }, null, req);
  res.json({ ok: true });
}));

// Weekly schedule (class sessions)
const slot = z.object({ subject: z.string().trim().min(1).max(100), dayOfWeek: z.number().int().min(1).max(7), sessionNo: z.number().int().min(1).max(10).default(1),
  startTime: hhmm, endTime: hhmm, room: z.string().trim().max(50).nullish() }).refine((s) => s.startTime < s.endTime, { message: 'END_BEFORE_START', path: ['endTime'] });
classesRouter.get('/:id/schedule', wrap(async (req, res) => {
  await assertClassAccess(req.user!, req.params.id);
  res.json({ items: await prisma.classSession.findMany({ where: { classId: req.params.id }, orderBy: [{ dayOfWeek: 'asc' }, { sessionNo: 'asc' }] }) });
}));
classesRouter.post('/:id/schedule', requireRole('ADMIN'), validate(slot), wrap(async (req, res) => {
  const s = await prisma.classSession.create({ data: { ...req.body, classId: req.params.id } });
  await audit(req.user, 'CREATE_SCHEDULE_SLOT', 'ClassSession', s.id, null, req.body, req);
  res.status(201).json({ item: s });
}));
classesRouter.delete('/:id/schedule/:slotId', requireRole('ADMIN'), wrap(async (req, res) => {
  await prisma.classSession.deleteMany({ where: { id: req.params.slotId, classId: req.params.id } });
  await audit(req.user, 'DELETE_SCHEDULE_SLOT', 'ClassSession', req.params.slotId, null, null, req);
  res.json({ ok: true });
}));

// ---------------- Monitors (admin only) ----------------
const perms = { canPublishAnnouncements: z.boolean().default(true), canExportReports: z.boolean().default(true), canRequestCorrections: z.boolean().default(true) };
const mInclude = { user: true, class: true } as const;
const flatMon = (m: any) => ({ id: m.id, userId: m.userId, fullName: m.user.fullName, email: m.user.email, isActive: m.user.isActive,
  classId: m.classId, className: m.class.name, canPublishAnnouncements: m.canPublishAnnouncements, canExportReports: m.canExportReports, canRequestCorrections: m.canRequestCorrections });

monitorsRouter.get('/', validate(pageQuery, 'query'), wrap(async (req, res) => {
  const q = req.query as any;
  const where = q.q ? { user: { OR: [{ fullName: { contains: q.q, mode: 'insensitive' as const } }, { email: { contains: q.q, mode: 'insensitive' as const } }] } } : {};
  const [total, items] = await Promise.all([prisma.classMonitor.count({ where }), prisma.classMonitor.findMany({ where, include: mInclude, orderBy: { user: { fullName: 'asc' } }, ...paginate(q.page, q.pageSize) })]);
  res.json({ items: items.map(flatMon), ...pageMeta(q.page, q.pageSize, total) });
}));
monitorsRouter.post('/', validate(z.object({ fullName: z.string().trim().min(2).max(100), email, password: password.optional(), classId: id, ...perms })), wrap(async (req, res) => {
  const { fullName, email: mail, password: pw, classId, ...p } = req.body;
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'MONITOR' } });
  const temp = pw ?? randomPassword();
  const m = await prisma.classMonitor.create({ data: { classId, ...p, user: { create: { fullName, email: mail, roleId: role.id, passwordHash: await argon2.hash(temp) } } }, include: mInclude });
  await audit(req.user, 'CREATE_MONITOR', 'ClassMonitor', m.id, null, { email: mail, classId }, req);
  res.status(201).json({ monitor: flatMon(m), temporaryPassword: pw ? undefined : temp });
}));
monitorsRouter.put('/:id', validate(z.object({ fullName: z.string().trim().min(2).max(100), classId: id, isActive: z.boolean().default(true), ...perms })), wrap(async (req, res) => {
  const old = await prisma.classMonitor.findUnique({ where: { id: req.params.id }, include: mInclude });
  if (!old) throw notFound();
  const { fullName, isActive, ...rest } = req.body;
  const m = await prisma.classMonitor.update({ where: { id: old.id }, data: { ...rest, user: { update: { fullName, isActive, ...(isActive ? {} : { refreshTokenHash: null }) } } }, include: mInclude });
  await audit(req.user, 'UPDATE_MONITOR', 'ClassMonitor', m.id, flatMon(old), flatMon(m), req);
  res.json({ monitor: flatMon(m) });
}));
monitorsRouter.delete('/:id', wrap(async (req, res) => {
  const m = await prisma.classMonitor.findUnique({ where: { id: req.params.id } });
  if (!m) throw notFound();
  await prisma.user.update({ where: { id: m.userId }, data: { isActive: false, refreshTokenHash: null } });
  await audit(req.user, 'DEACTIVATE_MONITOR', 'ClassMonitor', m.id, null, null, req);
  res.json({ ok: true });
}));
