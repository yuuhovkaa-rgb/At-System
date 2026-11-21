import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { monitorProfile, studentOf } from '../services/access';
import { audit } from '../utils/audit';
import { forbidden, notFound, wrap } from '../utils/errors';
import { notify } from '../utils/notify';
import { pageMeta, pageQuery, paginate } from '../utils/pagination';
import { id } from '../validators/common';

export const announcementsRouter = Router();
export const notificationsRouter = Router();
announcementsRouter.use(authenticate);
notificationsRouter.use(authenticate);

// Admin sees all; monitor/student see school-wide ones plus their own class's.
announcementsRouter.get('/', validate(pageQuery, 'query'), wrap(async (req, res) => {
  const u = req.user!; const q = req.query as any;
  let where: any = {};
  if (u.role === 'MONITOR') where = { OR: [{ classId: null }, { classId: (await monitorProfile(u.id)).classId }] };
  if (u.role === 'STUDENT') {
    const s = await studentOf(u.id);
    where = { OR: [{ classId: null }, { class: { students: { some: { studentId: s.id } } } }] };
  }
  const [total, items] = await Promise.all([prisma.announcement.count({ where }),
    prisma.announcement.findMany({ where, include: { author: { select: { fullName: true, role: { select: { name: true } } } }, class: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) })]);
  res.json({ items: items.map((a) => ({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt, author: a.author.fullName, authorRole: a.author.role.name, classId: a.classId, className: a.class?.name ?? null, authorId: a.authorId })), ...pageMeta(q.page, q.pageSize, total) });
}));

announcementsRouter.post('/', requireRole('ADMIN', 'MONITOR'), validate(z.object({ title: z.string().trim().min(3).max(150), body: z.string().trim().min(3).max(3000), classId: id.nullish() })), wrap(async (req, res) => {
  const u = req.user!; let classId: string | null = req.body.classId ?? null;
  if (u.role === 'MONITOR') {
    const m = await monitorProfile(u.id);
    if (!m.canPublishAnnouncements) throw forbidden('NO_PERMISSION');
    classId = m.classId; // monitors can only publish to their own class
  }
  const a = await prisma.announcement.create({ data: { title: req.body.title, body: req.body.body, classId, authorId: u.id } });
  await audit(u, 'CREATE_ANNOUNCEMENT', 'Announcement', a.id, null, { title: a.title, classId }, req);
  const recipients = await prisma.user.findMany({ where: { isActive: true, id: { not: u.id }, ...(classId ? { student: { classes: { some: { classId } } } } : {}) }, select: { id: true } });
  await notify(recipients.map((r) => r.id), 'new_announcement', { title: a.title });
  res.status(201).json({ id: a.id });
}));

announcementsRouter.delete('/:id', requireRole('ADMIN', 'MONITOR'), wrap(async (req, res) => {
  const a = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!a) throw notFound();
  if (req.user!.role !== 'ADMIN' && a.authorId !== req.user!.id) throw forbidden();
  await prisma.announcement.delete({ where: { id: a.id } });
  await audit(req.user, 'DELETE_ANNOUNCEMENT', 'Announcement', a.id, { title: a.title }, null, req);
  res.json({ ok: true });
}));

notificationsRouter.get('/', validate(pageQuery.extend({ unread: z.enum(['true', 'false']).optional() }), 'query'), wrap(async (req, res) => {
  const q = req.query as any; const where = { userId: req.user!.id, ...(q.unread === 'true' ? { isRead: false } : {}) };
  const [total, unread, items] = await Promise.all([prisma.notification.count({ where }), prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) })]);
  res.json({ items, unread, ...pageMeta(q.page, q.pageSize, total) });
}));
notificationsRouter.post('/read-all', wrap(async (req, res) => { await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } }); res.json({ ok: true }); }));
notificationsRouter.post('/:id/read', wrap(async (req, res) => { await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { isRead: true } }); res.json({ ok: true }); }));
