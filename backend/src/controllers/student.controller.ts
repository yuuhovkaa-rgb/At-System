import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { studentOf } from '../services/access';
import { rulesOf, statsFor } from '../services/attendanceStats';
import { getSettings } from '../utils/settings';
import { attendanceStats, countStatuses } from '../utils/stats';
import { audit } from '../utils/audit';
import { wrap } from '../utils/errors';
import { pageMeta, pageQuery, paginate } from '../utils/pagination';
import { dateOnly, ymd } from '../utils/time';
import { status, ymdDate } from '../validators/common';

/** Student portal. Every query is pinned to the caller's own student row: there is no :id parameter to tamper with. */
export const studentPortalRouter = Router();
studentPortalRouter.use(authenticate, requireRole('STUDENT'));

const filters = z.object({ from: ymdDate.optional(), to: ymdDate.optional(), status: status.optional() });
const whereFor = (studentId: string, q: any): Prisma.AttendanceRecordWhereInput => ({ studentId, ...(q.status ? { status: q.status } : {}),
  session: { status: 'SUBMITTED', ...((q.from || q.to) ? { date: { ...(q.from ? { gte: dateOnly(q.from) } : {}), ...(q.to ? { lte: dateOnly(q.to) } : {}) } } : {}) } });
const view = (r: any) => ({ id: r.id, date: ymd(r.session.date), sessionNo: r.session.sessionNo, subject: r.session.subject, className: r.session.class.name,
  status: r.status, checkInTime: r.checkInTime, remarks: r.remarks });
const inc = { session: { include: { class: { select: { name: true } } } } } as const;

studentPortalRouter.get('/me/attendance', validate(pageQuery.merge(filters), 'query'), wrap(async (req, res) => {
  const q = req.query as any; const s = await studentOf(req.user!.id); const where = whereFor(s.id, q);
  const [total, items] = await Promise.all([prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.findMany({ where, include: inc, orderBy: [{ session: { date: q.order === 'asc' ? 'asc' : 'desc' } }, { session: { sessionNo: 'desc' } }], ...paginate(q.page, q.pageSize) })]);
  res.json({ items: items.map(view), ...pageMeta(q.page, q.pageSize, total) });
}));

studentPortalRouter.get('/me/statistics', validate(filters, 'query'), wrap(async (req, res) => {
  const s = await studentOf(req.user!.id);
  const all = await prisma.attendanceRecord.findMany({ where: whereFor(s.id, req.query), select: { status: true, session: { select: { date: true } } } });
  const byMonth = new Map<string, string[]>();
  all.forEach((r) => { const k = ymd(r.session.date).slice(0, 7); (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(r.status); });
  const rules = rulesOf(await getSettings());
  res.json({ statistics: await statsFor(whereFor(s.id, req.query)),
    monthly: [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, st]) => ({ month, ...attendanceStats(countStatuses(st), rules) })) });
}));

studentPortalRouter.get('/me/calendar', validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }), 'query'), wrap(async (req, res) => {
  const s = await studentOf(req.user!.id); const m = (req.query as any).month as string;
  const next = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1));
  const items = await prisma.attendanceRecord.findMany({ where: { studentId: s.id, session: { status: 'SUBMITTED', date: { gte: dateOnly(`${m}-01`), lt: next } } }, include: inc, orderBy: { session: { date: 'asc' } } });
  res.json({ items: items.map(view) });
}));

studentPortalRouter.get('/me/schedule', wrap(async (req, res) => {
  const s = await studentOf(req.user!.id);
  const items = await prisma.classSession.findMany({ where: { class: { archived: false, students: { some: { studentId: s.id } } } }, include: { class: { select: { name: true } } }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
  res.json({ items: items.map((i) => ({ id: i.id, className: i.class.name, subject: i.subject, dayOfWeek: i.dayOfWeek, sessionNo: i.sessionNo, startTime: i.startTime, endTime: i.endTime, room: i.room })) });
}));

studentPortalRouter.get('/me', wrap(async (req, res) => {
  const s = await studentOf(req.user!.id);
  res.json({ studentCode: s.studentCode, phone: s.phone, address: s.address });
}));

// Students may only edit contact details; name/code/class are managed by admins.
studentPortalRouter.patch('/me', validate(z.object({ phone: z.string().trim().max(30).nullish(), address: z.string().trim().max(200).nullish() })), wrap(async (req, res) => {
  const s = await studentOf(req.user!.id);
  const u = await prisma.student.update({ where: { id: s.id }, data: { phone: req.body.phone ?? null, address: req.body.address ?? null } });
  await audit(req.user, 'UPDATE_OWN_PROFILE', 'Student', s.id, { phone: s.phone, address: s.address }, { phone: u.phone, address: u.address }, req);
  res.json({ phone: u.phone, address: u.address });
}));
