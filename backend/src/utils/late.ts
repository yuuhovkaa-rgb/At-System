import type { AttendanceStatus } from '@prisma/client';

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Late-arrival rule: a PRESENT student whose check-in is later than start + N minutes becomes LATE. */
export function resolveStatus(
  st: AttendanceStatus,
  checkIn: string | null | undefined,
  start: string | null | undefined,
  lateAfter: number,
): AttendanceStatus {
  if (st === 'PRESENT' && checkIn && start && minutesOf(checkIn) - minutesOf(start) > lateAfter) return 'LATE';
  return st;
}
