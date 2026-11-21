import { Router } from 'express';
import argon2 from 'argon2';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { assertStudentAccess, monitorProfile } from '../services/access';
import { statsFor } from '../services/attendanceStats';
import { audit } from '../utils/audit';
import { ApiError, conflict, notFound, wrap } from '../utils/errors';
import { Row, sendExport } from '../utils/export';
import { orderBy, pageMeta, pageQuery, paginate } from '../utils/pagination';
import { randomPassword } from '../utils/tokens';
import { dateOnly, ymd } from '../utils/time';
import { email, id, password, ymdDate } from '../validators/common';

export const studentsRouter = Router();
studentsRouter.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const include = { user: true, classes: { include: { class: true } } } satisfies Prisma.StudentInclude;
const flat = (s: Prisma.StudentGetPayload<{ include: typeof include }>) => ({
  id: s.id, userId: s.userId, studentCode: s.studentCode, fullName: s.user.fullName, email: s.user.email,
  isActive: s.user.isActive, gender: s.gender, phone: s.phone, address: s.address,
  dateOfBirth: s.dateOfBirth ? ymd(s.dateOfBirth) : null,
  classes: s.classes.map((c) => ({ id: c.class.id, code: c.class.code, name: c.class.name })),
});

const body = z.object({
  studentCode: z.string().trim().min(2).max(30),
  fullName: z.string().trim().min(2).max(100),
  email,
  gender: z.enum(['M', 'F', 'O']).nullish(),
  phone: z.string().trim().max(30).nullish(),
  address: z.string().trim().max(200).nullish(),
  dateOfBirth: ymdDate.nullish(),
  classId: id.nullish(),
  password: password.optional(),
});

async function createStudent(d: z.infer<typeof body>, pw?: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'STUDENT' } });
  const temp = pw ?? d.password ?? randomPassword();
  const s = await prisma.student.create({
    data: {
      studentCode: d.studentCode, gender: d.gender ?? null, phone: d.phone ?? null, address: d.address ?? null,
      dateOfBirth: d.dateOfBirth ? dateOnly(d.dateOfBirth) : null,
      user: { create: { email: d.email, fullName: d.fullName, roleId: role.id, passwordHash: await argon2.hash(temp) } },
      ...(d.classId ? { classes: { create: { classId: d.classId } } } : {}),
    },
    include,
  });
  return { student: s, temporaryPassword: d.password ? undefined : temp };
}

/** Admin: all students. Monitor: only students of their class (enforced here, not by the client). */
async function listWhere(req: any, q: any): Promise<Prisma.StudentWhereInput> {
  const and: Prisma.StudentWhereInput[] = [];
  if (req.user.role === 'MONITOR') and.push({ classes: { some: { classId: (await monitorProfile(req.user.id)).classId } } });
  else if (q.classId) and.push({ classes: { some: { classId: q.classId } } });
  if (q.active !== undefined) and.push({ user: { isActive: q.active === 'true' } });
  if (q.q) and.push({ OR: [
    { studentCode: { contains: q.q, mode: 'insensitive' } },
    { user: { fullName: { contains: q.q, mode: 'insensitive' } } },
    { user: { email: { contains: q.q, mode: 'insensitive' } } },
  ] });
  return { AND: and };
}
const listQuery = pageQuery.extend({ classId: id.optional(), active: z.enum(['true', 'false']).optional(), format: z.enum(['csv', 'xlsx', 'pdf']).default('csv') });

studentsRouter.get('/', requireRole('ADMIN', 'MONITOR'), validate(listQuery, 'query'), wrap(async (req, res) => {
  const q = req.query as any;
  const where = await listWhere(req, q);
  const sortMap: Record<string, any> = { fullName: { user: { fullName: q.order } }, email: { user: { email: q.order } }, studentCode: { studentCode: q.order } };
  const [total, items] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({ where, include, orderBy: sortMap[q.sort] ?? { studentCode: 'asc' }, ...paginate(q.page, q.pageSize) }),
  ]);
  res.json({ items: items.map(flat), ...pageMeta(q.page, q.pageSize, total) });
}));

studentsRouter.get('/export', requireRole('ADMIN'), validate(listQuery, 'query'), wrap(async (req, res) => {
  const q = req.query as any;
  const items = await prisma.student.findMany({ where: await listWhere(req, q), include, orderBy: { studentCode: 'asc' } });
  const rows: Row[] = items.map(flat).map((s) => ({ StudentCode: s.studentCode, FullName: s.fullName, Email: s.email, Gender: s.gender, Phone: s.phone,
    Classes: s.classes.map((c) => c.code).join('; '), Active: s.isActive ? 'yes' : 'no' }));
  await audit(req.user, 'EXPORT_STUDENTS', 'Student', null, null, { count: rows.length }, req);
  await sendExport(res, q.format, 'students', 'Students', `Exported ${new Date().toISOString().slice(0, 10)}`, [{ name: 'Students', rows }]);
}));

studentsRouter.get('/:id', validate(z.object({ id }), 'params'), wrap(async (req, res) => {
  await assertStudentAccess(req.user!, req.params.id); // students: own id only; monitors: own class only
  const s = await prisma.student.findUnique({ where: { id: req.params.id }, include });
  if (!s) throw notFound();
  const recent = await prisma.attendanceRecord.findMany({
    where: { studentId: s.id, session: { status: 'SUBMITTED' } }, orderBy: { session: { date: 'desc' } }, take: 10,
    include: { session: { select: { date: true, sessionNo: true, class: { select: { name: true } } } } },
  });
  res.json({ student: flat(s), statistics: await statsFor({ studentId: s.id }),
    recent: recent.map((r) => ({ id: r.id, date: ymd(r.session.date), sessionNo: r.session.sessionNo, className: r.session.class.name, status: r.status, checkInTime: r.checkInTime, remarks: r.remarks })) });
}));

studentsRouter.post('/', requireRole('ADMIN'), validate(body), wrap(async (req, res) => {
  const { student, temporaryPassword } = await createStudent(req.body);
  await audit(req.user, 'CREATE_STUDENT', 'Student', student.id, null, { studentCode: student.studentCode, email: student.user.email }, req);
  res.status(201).json({ student: flat(student), temporaryPassword });
}));

studentsRouter.put('/:id', requireRole('ADMIN'), validate(body.omit({ classId: true, password: true }).extend({ isActive: z.boolean().optional() })), wrap(async (req, res) => {
  const old = await prisma.student.findUnique({ where: { id: req.params.id }, include });
  if (!old) throw notFound();
  const d = req.body;
  const s = await prisma.student.update({
    where: { id: old.id },
    data: { studentCode: d.studentCode, gender: d.gender ?? null, phone: d.phone ?? null, address: d.address ?? null,
      dateOfBirth: d.dateOfBirth ? dateOnly(d.dateOfBirth) : null,
      user: { update: { fullName: d.fullName, email: d.email, ...(d.isActive === undefined ? {} : { isActive: d.isActive }),
        ...(d.isActive === false ? { refreshTokenHash: null } : {}) } } },
    include,
  });
  await audit(req.user, 'UPDATE_STUDENT', 'Student', s.id, flat(old), flat(s), req);
  res.json({ student: flat(s) });
}));

// Default: deactivate (keeps attendance history). ?permanent=true only works for students with no records.
studentsRouter.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const s = await prisma.student.findUnique({ where: { id: req.params.id }, include });
  if (!s) throw notFound();
  if (req.query.permanent === 'true') {
    if (await prisma.attendanceRecord.count({ where: { studentId: s.id } })) throw conflict('STUDENT_HAS_ATTENDANCE');
    await prisma.user.delete({ where: { id: s.userId } });
    await audit(req.user, 'DELETE_STUDENT', 'Student', s.id, flat(s), null, req);
  } else {
    await prisma.user.update({ where: { id: s.userId }, data: { isActive: false, refreshTokenHash: null } });
    await audit(req.user, 'DEACTIVATE_STUDENT', 'Student', s.id, { isActive: true }, { isActive: false }, req);
  }
  res.json({ ok: true });
}));

// CSV or XLSX import. Columns: studentCode, fullName, email, gender, phone, classCode
studentsRouter.post('/import', requireRole('ADMIN'), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'FILE_REQUIRED');
  let records: Record<string, string>[] = [];
  if (/\.xlsx$/i.test(req.file.originalname)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer as any);
    const ws = wb.worksheets[0];
    const head = (ws.getRow(1).values as any[]).slice(1).map((h) => String(h ?? '').trim());
    ws.eachRow((row, n) => { if (n > 1) records.push(Object.fromEntries(head.map((h, i) => {
      const v: any = row.getCell(i + 1).value; return [h, String(v?.text ?? v?.result ?? v ?? '').trim()]; }))); });
  } else {
    records = parse(req.file.buffer.toString('utf8').replace(/^\ufeff/, ''), { columns: (h: string[]) => h.map((x) => x.trim()), skip_empty_lines: true, trim: true });
  }
  if (records.length > 1000) throw new ApiError(400, 'TOO_MANY_ROWS');
  const classes = new Map((await prisma.class.findMany()).map((c) => [c.code, c.id]));
  const created: { studentCode: string; email: string; temporaryPassword: string }[] = [];
  const errors: { row: number; error: string }[] = [];
  for (const [i, r] of records.entries()) {
    const parsed = body.omit({ classId: true, password: true }).safeParse({ ...r, gender: r.gender || null, phone: r.phone || null, address: null, dateOfBirth: null });
    if (!parsed.success) { errors.push({ row: i + 2, error: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join(', ') }); continue; }
    const classId = r.classCode ? classes.get(r.classCode) : undefined;
    if (r.classCode && !classId) { errors.push({ row: i + 2, error: `classCode ${r.classCode} not found` }); continue; }
    try {
      const { temporaryPassword } = await createStudent({ ...parsed.data, classId: classId ?? null });
      created.push({ studentCode: parsed.data.studentCode, email: parsed.data.email, temporaryPassword: temporaryPassword! });
    } catch (e: any) {
      errors.push({ row: i + 2, error: e?.code === 'P2002' ? 'duplicate studentCode or email' : 'could not be created' });
    }
  }
  await audit(req.user, 'IMPORT_STUDENTS', 'Student', null, null, { created: created.length, failed: errors.length }, req);
  res.json({ created: created.length, failed: errors.length, errors, credentials: created });
}));
