import { prisma } from '../config/db';
import { AuthUser } from '../middleware/auth';
import { forbidden, notFound } from '../utils/errors';

/** The monitor's assigned class (monitors manage exactly one class). */
export async function monitorProfile(userId: string) {
  const m = await prisma.classMonitor.findUnique({ where: { userId } });
  if (!m) throw forbidden('NO_ASSIGNED_CLASS');
  return m;
}

export async function studentOf(userId: string) {
  const s = await prisma.student.findUnique({ where: { userId } });
  if (!s) throw notFound('STUDENT_PROFILE_NOT_FOUND');
  return s;
}

/** Throws unless the user may manage/see this class. Admin: any. Monitor: only assigned. */
export async function assertClassAccess(user: AuthUser, classId: string) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'MONITOR') {
    const m = await monitorProfile(user.id);
    if (m.classId === classId) return;
  }
  throw forbidden('CLASS_NOT_ASSIGNED');
}

/** Class ids the user may see: undefined = all (admin). */
export async function visibleClassIds(user: AuthUser): Promise<string[] | undefined> {
  if (user.role === 'ADMIN') return undefined;
  if (user.role === 'MONITOR') return [(await monitorProfile(user.id)).classId];
  const s = await studentOf(user.id);
  return (await prisma.classStudent.findMany({ where: { studentId: s.id }, select: { classId: true } })).map((c) => c.classId);
}

/** Throws unless the user may read this student's data. */
export async function assertStudentAccess(user: AuthUser, studentId: string) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'STUDENT') {
    const s = await studentOf(user.id);
    if (s.id === studentId) return;
    throw forbidden('NOT_YOUR_RECORD');
  }
  const m = await monitorProfile(user.id);
  const link = await prisma.classStudent.findFirst({ where: { studentId, classId: m.classId } });
  if (!link) throw forbidden('STUDENT_NOT_IN_YOUR_CLASS');
}
