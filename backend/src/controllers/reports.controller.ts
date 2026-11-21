import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { monitorProfile } from '../services/access';
import { buildReport } from '../services/reports';
import { audit } from '../utils/audit';
import { forbidden, wrap } from '../utils/errors';
import { sendExport } from '../utils/export';
import { id, status, ymdDate } from '../validators/common';

export const reportsRouter = Router();
reportsRouter.use(authenticate, requireRole('ADMIN', 'MONITOR'));

const q = z.object({ from: ymdDate.optional(), to: ymdDate.optional(), classId: id.optional(), studentId: id.optional(), status: status.optional(),
  academicYearId: id.optional(), semesterId: id.optional(), period: z.enum(['day', 'week', 'month']).default('day'), format: z.enum(['csv', 'xlsx', 'pdf']).default('csv') });

reportsRouter.get('/', validate(q, 'query'), wrap(async (req, res) => {
  const r = await buildReport(req.user!, req.query as any);
  if (!r) throw forbidden('CLASS_NOT_ASSIGNED');
  const { rows, ...rest } = r;
  res.json({ ...rest, rowCount: rows.length });
}));

reportsRouter.get('/export', validate(q, 'query'), wrap(async (req, res) => {
  if (req.user!.role === 'MONITOR' && !(await monitorProfile(req.user!.id)).canExportReports) throw forbidden('NO_PERMISSION');
  const { format, ...f } = req.query as any;
  const r = await buildReport(req.user!, f);
  if (!r) throw forbidden('CLASS_NOT_ASSIGNED');
  await audit(req.user, 'EXPORT_REPORT', 'Report', null, null, { ...f, format, rows: r.rows.length }, req);
  const summary = r.students.map((s) => ({ StudentCode: s.studentCode, Student: s.fullName, Present: s.present, Late: s.late, Absent: s.absent, Excused: s.excused, 'Attendance %': s.percentage }));
  await sendExport(res, format, `attendance-report-${r.filters.from}_${r.filters.to}`, 'Attendance Report', `${r.filters.from} to ${r.filters.to}  |  overall ${r.summary.percentage}%`,
    [{ name: 'Per student', rows: summary }, { name: 'Records', rows: format === 'csv' ? r.rows : r.rows }]);
}));
