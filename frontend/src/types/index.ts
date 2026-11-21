export type Role = 'ADMIN' | 'MONITOR' | 'STUDENT';
export type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export const STATUSES: Status[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

export interface User {
  id: string; email: string; fullName: string; role: Role; isActive: boolean; language: 'en' | 'kh'; theme: 'light' | 'dark';
  studentId: string | null; studentCode: string | null; classId: string | null;
  permissions: { canPublishAnnouncements: boolean; canExportReports: boolean; canRequestCorrections: boolean } | null;
}
export interface Paged<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export interface Counts { present: number; absent: number; late: number; excused: number }
export interface Stats extends Counts { total: number; eligible: number; percentage: number }
export interface ClassLite { id: string; code: string; name: string }
export interface StudentRow {
  id: string; studentCode: string; fullName: string; email: string; isActive: boolean; gender: string | null; phone: string | null;
  address: string | null; dateOfBirth: string | null; classes: ClassLite[];
}
export interface ClassRow extends ClassLite {
  description: string | null; archived: boolean; studentCount: number; academicYear: { id: string; name: string } | null; semester: { id: string; name: string } | null;
  monitors: { id: string; userId: string; fullName: string; email: string }[];
}
export interface SessionRow {
  id: string; classId: string; className: string; classCode: string; date: string; sessionNo: number; subject: string | null; startTime: string | null;
  status: 'OPEN' | 'SUBMITTED'; counts?: Counts;
}
export interface Settings {
  schoolName: string; timezone: string; excusedPolicy: 'EXCLUDE' | 'COUNT_AS_PRESENT' | 'COUNT_AS_ABSENT';
  lateCountsAsPresent: boolean; lateAfterMinutes: number; minAttendancePercent: number;
}
export interface AcademicYear { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; semesters: { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }[] }
