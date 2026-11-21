import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { Counts, Rules, attendanceStats, emptyCounts } from '../utils/stats';
import { getSettings } from '../utils/settings';

export const rulesOf = (s: { excusedPolicy: Rules['excusedPolicy']; lateCountsAsPresent: boolean }): Rules => ({
  excusedPolicy: s.excusedPolicy, lateCountsAsPresent: s.lateCountsAsPresent,
});

/** Count statuses of records (submitted sessions only) matching `where`. */
export async function countRecords(where: Prisma.AttendanceRecordWhereInput): Promise<Counts> {
  const rows = await prisma.attendanceRecord.groupBy({
    by: ['status'],
    where: { ...where, session: { ...(where.session as object), status: 'SUBMITTED' } },
    _count: { _all: true },
  });
  const c = emptyCounts();
  for (const r of rows) c[r.status.toLowerCase() as keyof Counts] = r._count._all;
  return c;
}

export async function statsFor(where: Prisma.AttendanceRecordWhereInput) {
  const settings = await getSettings();
  return attendanceStats(await countRecords(where), rulesOf(settings));
}
