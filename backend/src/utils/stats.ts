/**
 * Attendance percentage rules (pure functions, unit-tested).
 *
 *   percentage = numerator / eligible * 100
 *
 * Default: PRESENT + LATE count in the numerator (configurable via lateCountsAsPresent);
 * the denominator is every PRESENT, ABSENT and LATE session. EXCUSED sessions are handled
 * by the configurable `excusedPolicy`:
 *   EXCLUDE          (default) excused sessions are ignored entirely
 *   COUNT_AS_PRESENT excused sessions add to numerator and denominator
 *   COUNT_AS_ABSENT  excused sessions add to the denominator only
 */
export type ExcusedPolicy = 'EXCLUDE' | 'COUNT_AS_PRESENT' | 'COUNT_AS_ABSENT';
export interface Counts { present: number; absent: number; late: number; excused: number }
export interface Rules { excusedPolicy: ExcusedPolicy; lateCountsAsPresent: boolean }
export interface Stats extends Counts { total: number; eligible: number; percentage: number }

export const emptyCounts = (): Counts => ({ present: 0, absent: 0, late: 0, excused: 0 });

export function attendanceStats(c: Counts, rules: Rules): Stats {
  const total = c.present + c.absent + c.late + c.excused;
  let numerator = c.present + (rules.lateCountsAsPresent ? c.late : 0);
  let eligible = c.present + c.absent + c.late;
  if (rules.excusedPolicy === 'COUNT_AS_PRESENT') {
    numerator += c.excused;
    eligible += c.excused;
  } else if (rules.excusedPolicy === 'COUNT_AS_ABSENT') {
    eligible += c.excused;
  }
  const percentage = eligible === 0 ? 0 : Math.round((numerator / eligible) * 1000) / 10;
  return { ...c, total, eligible, percentage };
}

export function countStatuses(statuses: string[]): Counts {
  const c = emptyCounts();
  for (const s of statuses) {
    if (s === 'PRESENT') c.present++;
    else if (s === 'ABSENT') c.absent++;
    else if (s === 'LATE') c.late++;
    else if (s === 'EXCUSED') c.excused++;
  }
  return c;
}
