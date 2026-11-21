import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { AuthUser } from '../middleware/auth';
import { visibleClassIds } from './access';
import { rulesOf } from './attendanceStats';
import { getSettings } from '../utils/settings';
import { Counts, attendanceStats, countStatuses, emptyCounts } from '../utils/stats';
import { dateOnly, dayjs, ymd } from '../utils/time';

export interface ReportFilter {
  from?: string; to?: string; classId?: string; studentId?: string; status?: string;
  academicYearId?: string; semesterId?: string; period?: 'day' | 'week' | 'month';
}

/** Builds report data from SUBMITTED sessions only. Aggregation is done in memory (capped at 50k rows). */
export async function buildReport(user: AuthUser, f: ReportFilter) {
  const settings = await getSettings();
  const rules = rulesOf(settings);
  const ids = await visibleClassIds(user);
  if (ids && f.classId && !ids.includes(f.classId)) return null; // monitor asked for foreign class

  let from = f.from, to = f.to;
  const range = f.semesterId ? await prisma.semester.findUnique({ where: { id: f.semesterId } })
    : f.academicYearId ? await prisma.academicYear.findUnique({ where: { id: f.academicYearId } }) : null;
  if (range) { const a = ymd(range.startDate), b = ymd(range.endDate); from = from && from > a ? from : a; to = to && to < b ? to : b; }
  from ??= dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  to ??= dayjs().format('YYYY-MM-DD');

  const where: Prisma.AttendanceRecordWhereInput = {
    session: { status: 'SUBMITTED', date: { gte: dateOnly(from), lte: dateOnly(to) },
      ...(f.classId ? { classId: f.classId } : ids ? { classId: { in: ids } } : {}) },
    ...(f.studentId ? { studentId: f.studentId } : {}),
    ...(f.status ? { status: f.status as never } : {}),
  };
  const recs = await prisma.attendanceRecord.findMany({ where, take: 50000, orderBy: [{ session: { date: 'asc' } }, { session: { sessionNo: 'asc' } }],
    include: { session: { include: { class: { select: { name: true, code: true } } } }, student: { include: { user: { select: { fullName: true } } } } } });

  const key = (d: Date) => { const s = ymd(d); return f.period === 'month' ? s.slice(0, 7) : f.period === 'week' ? dayjs(s).startOf('week').add(1, 'day').format('YYYY-MM-DD') : s; };
  const trendMap = new Map<string, string[]>(), studentMap = new Map<string, { code: string; name: string; st: string[] }>(), classMap = new Map<string, { name: string; st: string[] }>();
  for (const r of recs) {
    const k = key(r.session.date);
    (trendMap.get(k) ?? trendMap.set(k, []).get(k)!).push(r.status);
    (studentMap.get(r.studentId) ?? studentMap.set(r.studentId, { code: r.student.studentCode, name: r.student.user.fullName, st: [] }).get(r.studentId)!).st.push(r.status);
    (classMap.get(r.session.classId) ?? classMap.set(r.session.classId, { name: r.session.class.name, st: [] }).get(r.session.classId)!).st.push(r.status);
  }
  const withPct = (c: Counts) => attendanceStats(c, rules);
  return {
    filters: { ...f, from, to }, rules,
    summary: withPct(countStatuses(recs.map((r) => r.status))),
    trend: [...trendMap].sort(([a], [b]) => a.localeCompare(b)).map(([period, st]) => ({ period, ...withPct(countStatuses(st)) })),
    students: [...studentMap].map(([studentId, v]) => ({ studentId, studentCode: v.code, fullName: v.name, ...withPct(countStatuses(v.st)), atRisk: withPct(countStatuses(v.st)).percentage < settings.minAttendancePercent && v.st.length > 0 }))
      .sort((a, b) => a.percentage - b.percentage),
    classes: [...classMap].map(([classId, v]) => ({ classId, name: v.name, ...withPct(countStatuses(v.st)) })).sort((a, b) => b.percentage - a.percentage),
    rows: recs.map((r) => ({ Date: ymd(r.session.date), Session: r.session.sessionNo, Class: r.session.class.name, StudentCode: r.student.studentCode,
      Student: r.student.user.fullName, Status: r.status, CheckIn: r.checkInTime ?? '', Remarks: r.remarks ?? '' })),
    truncated: recs.length >= 50000,
  };
}
export { emptyCounts };
