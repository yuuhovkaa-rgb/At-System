import { Router } from 'express';
import { z } from 'zod';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { AuthUser, authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { assertClassAccess, monitorProfile, studentOf, visibleClassIds } from '../services/access';
import { audit } from '../utils/audit';
import { ApiError, conflict, forbidden, notFound, wrap } from '../utils/errors';
import { adminIds, notify } from '../utils/notify';
import { pageMeta, pageQuery, paginate } from '../utils/pagination';
import { getSettings } from '../utils/settings';
import { resolveStatus } from '../utils/late';
import { countStatuses } from '../utils/stats';
import { dateOnly, todayIn, ymd } from '../utils/time';
import { hhmm, id, status, ymdDate } from '../validators/common';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);
const staff = requireRole('ADMIN', 'MONITOR');

const recView = (r: { id: string; status: string; checkInTime: string | null; remarks: string | null; updatedAt: Date; studentId: string }) =>
  ({ id: r.id, studentId: r.studentId, status: r.status, checkInTime: r.checkInTime, remarks: r.remarks, updatedAt: r.updatedAt });

async function loadSession(user: AuthUser, sessionId: string) {
  const s = await prisma.attendanceSession.findUnique({ where: { id: sessionId }, include: { class: true } });
  if (!s) throw notFound('SESSION_NOT_FOUND');
  await assertClassAccess(user, s.classId);
  return s;
}
const sessionView = (s: any, counts?: any) => ({ id: s.id, classId: s.classId, className: s.class?.name, classCode: s.class?.code,
  date: ymd(s.date), sessionNo: s.sessionNo, subject: s.subject, startTime: s.startTime, status: s.status, submittedAt: s.submittedAt, counts });

// ---------- sessions ----------
attendanceRouter.post('/sessions', staff, validate(z.object({ classId: id.optional(), date: ymdDate, sessionNo: z.number().int().min(1).max(10).default(1),
  subject: z.string().trim().max(100).nullish(), startTime: hhmm.nullish() })), wrap(async (req, res) => {
  const u = req.user!; const b = req.body;
  const classId = u.role === 'MONITOR' ? (await monitorProfile(u.id)).classId : b.classId;
  if (!classId) throw new ApiError(400, 'CLASS_REQUIRED');
  await assertClassAccess(u, classId);
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls || cls.archived) throw notFound('CLASS_NOT_FOUND');
  const settings = await getSettings();
  if (b.date > todayIn(settings.timezone)) throw new ApiError(400, 'DATE_IN_FUTURE');
  const exists = await prisma.attendanceSession.findUnique({ where: { classId_date_sessionNo: { classId, date: dateOnly(b.date), sessionNo: b.sessionNo } } });
  if (exists) throw conflict('DUPLICATE_SESSION', { sessionId: exists.id });
  const s = await prisma.attendanceSession.create({ data: { classId, date: dateOnly(b.date), sessionNo: b.sessionNo, subject: b.subject ?? null, startTime: b.startTime ?? null, createdById: u.id }, include: { class: true } });
  await audit(u, 'CREATE_ATTENDANCE_SESSION', 'AttendanceSession', s.id, null, { classId, date: b.date, sessionNo: b.sessionNo }, req);
  res.status(201).json({ session: sessionView(s) });
}));

attendanceRouter.get('/sessions', staff, validate(pageQuery.extend({ classId: id.optional(), from: ymdDate.optional(), to: ymdDate.optional(), status: z.enum(['OPEN', 'SUBMITTED']).optional() }), 'query'), wrap(async (req, res) => {
  const q = req.query as any;
  const ids = await visibleClassIds(req.user!);
  const where: Prisma.AttendanceSessionWhereInput = { ...(ids ? { classId: { in: ids } } : {}), ...(q.classId ? { classId: q.classId, ...(ids && !ids.includes(q.classId) ? { id: 'none' } : {}) } : {}),
    ...(q.status ? { status: q.status } : {}), ...((q.from || q.to) ? { date: { ...(q.from ? { gte: dateOnly(q.from) } : {}), ...(q.to ? { lte: dateOnly(q.to) } : {}) } } : {}) };
  const [total, items] = await Promise.all([prisma.attendanceSession.count({ where }),
    prisma.attendanceSession.findMany({ where, include: { class: true }, orderBy: [{ date: 'desc' }, { sessionNo: 'desc' }], ...paginate(q.page, q.pageSize) })]);
  const recs = await prisma.attendanceRecord.findMany({ where: { sessionId: { in: items.map((i) => i.id) } }, select: { sessionId: true, status: true } });
  res.json({ items: items.map((s) => sessionView(s, countStatuses(recs.filter((r) => r.sessionId === s.id).map((r) => r.status)))), ...pageMeta(q.page, q.pageSize, total) });
}));

attendanceRouter.get('/sessions/:id', staff, wrap(async (req, res) => {
  const s = await loadSession(req.user!, req.params.id);
  const [students, records] = await Promise.all([
    prisma.classStudent.findMany({ where: { classId: s.classId, student: { user: { isActive: true } } }, include: { student: { include: { user: true } } }, orderBy: { student: { studentCode: 'asc' } } }),
    prisma.attendanceRecord.findMany({ where: { sessionId: s.id } }),
  ]);
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  res.json({ session: sessionView(s, countStatuses(records.map((r) => r.status))),
    students: students.map((c) => ({ studentId: c.studentId, studentCode: c.student.studentCode, fullName: c.student.user.fullName,
      record: byStudent.get(c.studentId) ? recView(byStudent.get(c.studentId)!) : null })) });
}));

// Bulk save while the session is OPEN. Unmarked students stay unrecorded (NOT auto-absent) until submit.
attendanceRouter.post('/sessions/:id/records', staff, validate(z.object({ records: z.array(z.object({ studentId: id, status, checkInTime: hhmm.nullish(), remarks: z.string().trim().max(300).nullish() })).min(1).max(500) })), wrap(async (req, res) => {
  const u = req.user!; const s = await loadSession(u, req.params.id);
  if (s.status === 'SUBMITTED') throw new ApiError(423, 'SESSION_LOCKED');
  const settings = await getSettings();
  const members = new Set((await prisma.classStudent.findMany({ where: { classId: s.classId }, select: { studentId: true } })).map((m) => m.studentId));
  const input: { studentId: string; status: AttendanceStatus; checkInTime?: string | null; remarks?: string | null }[] = req.body.records;
  if (input.some((r) => !members.has(r.studentId))) throw new ApiError(400, 'STUDENT_NOT_IN_CLASS');
  if (new Set(input.map((r) => r.studentId)).size !== input.length) throw new ApiError(400, 'DUPLICATE_STUDENT_IN_REQUEST');
  const existing = new Map((await prisma.attendanceRecord.findMany({ where: { sessionId: s.id, studentId: { in: input.map((r) => r.studentId) } } })).map((r) => [r.studentId, r]));
  await prisma.$transaction(input.map((r) => {
    const st = resolveStatus(r.status, r.checkInTime, s.startTime, settings.lateAfterMinutes);
    const data = { status: st, checkInTime: r.checkInTime ?? null, remarks: r.remarks ?? null, recordedById: u.id };
    return prisma.attendanceRecord.upsert({ where: { sessionId_studentId: { sessionId: s.id, studentId: r.studentId } }, update: data, create: { ...data, sessionId: s.id, studentId: r.studentId } });
  }));
  for (const r of input) {
    const old = existing.get(r.studentId);
    const st = resolveStatus(r.status, r.checkInTime, s.startTime, settings.lateAfterMinutes);
    if (!old || old.status !== st || old.remarks !== (r.remarks ?? null) || old.checkInTime !== (r.checkInTime ?? null))
      await audit(u, old ? 'UPDATE_ATTENDANCE' : 'CREATE_ATTENDANCE', 'AttendanceRecord', `${s.id}:${r.studentId}`, old ? { status: old.status, checkInTime: old.checkInTime, remarks: old.remarks } : null, { status: st, checkInTime: r.checkInTime ?? null, remarks: r.remarks ?? null }, req);
  }
  const all = await prisma.attendanceRecord.findMany({ where: { sessionId: s.id }, select: { status: true } });
  res.json({ saved: input.length, counts: countStatuses(all.map((r) => r.status)) });
}));

// Submit & lock. Only now are students without a record marked ABSENT.
attendanceRouter.post('/sessions/:id/submit', staff, wrap(async (req, res) => {
  const u = req.user!; const s = await loadSession(u, req.params.id);
  if (s.status === 'SUBMITTED') throw new ApiError(423, 'SESSION_LOCKED');
  const [members, recs] = await Promise.all([
    prisma.classStudent.findMany({ where: { classId: s.classId, student: { user: { isActive: true } } }, include: { student: true } }),
    prisma.attendanceRecord.findMany({ where: { sessionId: s.id } }),
  ]);
  const have = new Set(recs.map((r) => r.studentId));
  const missing = members.filter((m) => !have.has(m.studentId));
  await prisma.$transaction([
    ...(missing.length ? [prisma.attendanceRecord.createMany({ data: missing.map((m) => ({ sessionId: s.id, studentId: m.studentId, status: 'ABSENT' as const, remarks: 'Auto-marked absent on submit', recordedById: u.id })) })] : []),
    prisma.attendanceSession.update({ where: { id: s.id }, data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: u.id } }),
  ]);
  const finalRecs = await prisma.attendanceRecord.findMany({ where: { sessionId: s.id }, include: { student: true } });
  const counts = countStatuses(finalRecs.map((r) => r.status));
  await audit(u, 'SUBMIT_ATTENDANCE_SESSION', 'AttendanceSession', s.id, { status: 'OPEN' }, { status: 'SUBMITTED', autoAbsent: missing.length, ...counts }, req);
  await notify([u.id], 'attendance_submitted', { className: s.class.name, date: ymd(s.date), ...counts });
  await notify(finalRecs.filter((r) => r.status === 'ABSENT').map((r) => r.student.userId), 'student_marked_absent', { className: s.class.name, date: ymd(s.date) });
  res.json({ session: sessionView({ ...s, status: 'SUBMITTED' }, counts), autoMarkedAbsent: missing.length });
}));

// ---------- single record edit ----------
attendanceRouter.put('/records/:id', staff, validate(z.object({ status, checkInTime: hhmm.nullish(), remarks: z.string().trim().max(300).nullish(), reason: z.string().trim().min(3).max(300).optional() })), wrap(async (req, res) => {
  const u = req.user!;
  const rec = await prisma.attendanceRecord.findUnique({ where: { id: req.params.id }, include: { session: true, student: true } });
  if (!rec) throw notFound();
  await assertClassAccess(u, rec.session.classId);
  const locked = rec.session.status === 'SUBMITTED';
  if (locked && u.role !== 'ADMIN') throw new ApiError(423, 'SESSION_LOCKED'); // monitors must file a correction request
  if (locked && !req.body.reason) throw new ApiError(400, 'REASON_REQUIRED');
  const settings = await getSettings();
  const st = resolveStatus(req.body.status, req.body.checkInTime, rec.session.startTime, settings.lateAfterMinutes);
  const upd = await prisma.attendanceRecord.update({ where: { id: rec.id }, data: { status: st, checkInTime: req.body.checkInTime ?? null, remarks: req.body.remarks ?? null, recordedById: u.id } });
  await audit(u, locked ? 'ADMIN_CORRECT_ATTENDANCE' : 'UPDATE_ATTENDANCE', 'AttendanceRecord', rec.id,
    { status: rec.status, checkInTime: rec.checkInTime, remarks: rec.remarks }, { status: upd.status, checkInTime: upd.checkInTime, remarks: upd.remarks, reason: req.body.reason ?? null }, req);
  if (locked && rec.status !== upd.status) await notify([rec.student.userId], 'attendance_corrected', { date: ymd(rec.session.date), status: upd.status });
  res.json({ record: recView(upd) });
}));

// ---------- correction requests ----------
const corrInclude = { requestedBy: { select: { fullName: true, role: { select: { name: true } } } }, reviewedBy: { select: { fullName: true } },
  record: { include: { student: { include: { user: { select: { fullName: true } } } }, session: { include: { class: { select: { name: true } } } } } } } as const;
const corrView = (c: any) => ({ id: c.id, status: c.status, requestedStatus: c.requestedStatus, reason: c.reason, reviewNote: c.reviewNote, createdAt: c.createdAt, reviewedAt: c.reviewedAt,
  requestedBy: c.requestedBy.fullName, requestedByRole: c.requestedBy.role.name, reviewedBy: c.reviewedBy?.fullName ?? null,
  recordId: c.recordId, currentStatus: c.record.status, date: ymd(c.record.session.date), sessionNo: c.record.session.sessionNo, className: c.record.session.class.name,
  studentCode: c.record.student.studentCode, studentName: c.record.student.user.fullName });

attendanceRouter.post('/corrections', requireRole('MONITOR', 'STUDENT'), validate(z.object({ recordId: id, requestedStatus: status, reason: z.string().trim().min(5).max(500) })), wrap(async (req, res) => {
  const u = req.user!;
  const rec = await prisma.attendanceRecord.findUnique({ where: { id: req.body.recordId }, include: { session: { include: { class: true } }, student: true } });
  if (!rec) throw notFound();
  if (u.role === 'STUDENT') { if (rec.studentId !== (await studentOf(u.id)).id) throw forbidden('NOT_YOUR_RECORD'); }
  else { const m = await monitorProfile(u.id); if (m.classId !== rec.session.classId) throw forbidden('CLASS_NOT_ASSIGNED'); if (!m.canRequestCorrections) throw forbidden('NO_PERMISSION'); }
  if (rec.session.status !== 'SUBMITTED') throw new ApiError(400, 'SESSION_NOT_SUBMITTED');
  if (rec.status === req.body.requestedStatus) throw new ApiError(400, 'SAME_STATUS');
  if (await prisma.attendanceCorrectionRequest.findFirst({ where: { recordId: rec.id, requestedById: u.id, status: 'PENDING' } })) throw conflict('REQUEST_ALREADY_PENDING');
  const c = await prisma.attendanceCorrectionRequest.create({ data: { ...req.body, requestedById: u.id }, include: corrInclude });
  await audit(u, 'REQUEST_CORRECTION', 'AttendanceCorrectionRequest', c.id, { status: rec.status }, { requestedStatus: req.body.requestedStatus }, req);
  const monitors = u.role === 'STUDENT' ? (await prisma.classMonitor.findMany({ where: { classId: rec.session.classId }, select: { userId: true } })).map((m) => m.userId) : [];
  await notify([...(await adminIds()), ...monitors], 'correction_request_received', { student: rec.student.studentCode, date: ymd(rec.session.date) });
  res.status(201).json({ request: corrView(c) });
}));

attendanceRouter.get('/corrections', validate(pageQuery.extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }), 'query'), wrap(async (req, res) => {
  const u = req.user!; const q = req.query as any;
  const scope: Prisma.AttendanceCorrectionRequestWhereInput =
    u.role === 'ADMIN' ? {} : u.role === 'MONITOR' ? { record: { session: { classId: (await monitorProfile(u.id)).classId } } } : { requestedById: u.id };
  const where = { ...scope, ...(q.status ? { status: q.status } : {}) };
  const [total, items] = await Promise.all([prisma.attendanceCorrectionRequest.count({ where }),
    prisma.attendanceCorrectionRequest.findMany({ where, include: corrInclude, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) })]);
  res.json({ items: items.map(corrView), ...pageMeta(q.page, q.pageSize, total) });
}));

// Admin reviews anything. A monitor may only review requests made by STUDENTS of their own class.
attendanceRouter.post('/corrections/:id/review', staff, validate(z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().trim().max(300).optional() })), wrap(async (req, res) => {
  const u = req.user!;
  const c = await prisma.attendanceCorrectionRequest.findUnique({ where: { id: req.params.id }, include: { requestedBy: { include: { role: true } }, record: { include: { session: true, student: true } } } });
  if (!c) throw notFound();
  if (c.status !== 'PENDING') throw conflict('ALREADY_REVIEWED');
  if (u.role === 'MONITOR') {
    await assertClassAccess(u, c.record.session.classId);
    if (c.requestedBy.role.name !== 'STUDENT') throw forbidden('ADMIN_ONLY');
  }
  await prisma.$transaction([
    prisma.attendanceCorrectionRequest.update({ where: { id: c.id }, data: { status: req.body.decision, reviewNote: req.body.note ?? null, reviewedById: u.id, reviewedAt: new Date() } }),
    ...(req.body.decision === 'APPROVED' ? [prisma.attendanceRecord.update({ where: { id: c.recordId }, data: { status: c.requestedStatus, recordedById: u.id } })] : []),
  ]);
  await audit(u, req.body.decision === 'APPROVED' ? 'APPROVE_CORRECTION' : 'REJECT_CORRECTION', 'AttendanceRecord', c.recordId,
    { status: c.record.status }, { status: req.body.decision === 'APPROVED' ? c.requestedStatus : c.record.status, requestId: c.id, note: req.body.note ?? null }, req);
  const type = req.body.decision === 'APPROVED' ? 'correction_approved' : 'correction_rejected';
  await notify([c.requestedById, c.record.student.userId], type, { date: ymd(c.record.session.date), status: c.requestedStatus });
  res.json({ ok: true });
}));
