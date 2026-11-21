import { describe, expect, it } from 'vitest';
import { attendanceStats, countStatuses } from '../src/utils/stats';
import { resolveStatus } from '../src/utils/late';

const c = { present: 8, absent: 1, late: 1, excused: 2 };
describe('attendance percentage', () => {
  it('EXCLUDE: excused are ignored', () => expect(attendanceStats(c, { excusedPolicy: 'EXCLUDE', lateCountsAsPresent: true }).percentage).toBe(90));
  it('COUNT_AS_PRESENT: excused in numerator and denominator', () => expect(attendanceStats(c, { excusedPolicy: 'COUNT_AS_PRESENT', lateCountsAsPresent: true }).percentage).toBe(91.7));
  it('COUNT_AS_ABSENT: excused only in denominator', () => expect(attendanceStats(c, { excusedPolicy: 'COUNT_AS_ABSENT', lateCountsAsPresent: true }).percentage).toBe(75));
  it('late can be configured as not present', () => expect(attendanceStats(c, { excusedPolicy: 'EXCLUDE', lateCountsAsPresent: false }).percentage).toBe(80));
  it('no eligible sessions gives 0, never NaN', () => expect(attendanceStats({ present: 0, absent: 0, late: 0, excused: 3 }, { excusedPolicy: 'EXCLUDE', lateCountsAsPresent: true }).percentage).toBe(0));
  it('countStatuses', () => expect(countStatuses(['PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'])).toEqual({ present: 2, absent: 1, late: 1, excused: 1 }));
});
describe('late-arrival rule', () => {
  it('flags check-in after grace as LATE', () => expect(resolveStatus('PRESENT', '08:20', '08:00', 15)).toBe('LATE'));
  it('keeps PRESENT within grace', () => expect(resolveStatus('PRESENT', '08:15', '08:00', 15)).toBe('PRESENT'));
  it('never touches other statuses', () => expect(resolveStatus('ABSENT', '09:00', '08:00', 15)).toBe('ABSENT'));
});
