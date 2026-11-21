import argon2 from 'argon2';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/db';

export const api = () => request(app);
export const PW = 'Passw0rd!x';

export async function resetDb() {
  await prisma.$transaction([
    prisma.notification.deleteMany(), prisma.auditLog.deleteMany(), prisma.attendanceCorrectionRequest.deleteMany(), prisma.attendanceRecord.deleteMany(),
    prisma.attendanceSession.deleteMany(), prisma.announcement.deleteMany(), prisma.classSession.deleteMany(), prisma.classMonitor.deleteMany(),
    prisma.classStudent.deleteMany(), prisma.student.deleteMany(), prisma.class.deleteMany(), prisma.semester.deleteMany(), prisma.academicYear.deleteMany(),
    prisma.user.deleteMany(), prisma.role.deleteMany(), prisma.systemSetting.deleteMany(),
  ]);
}

/** Two classes (A, B), one admin, a monitor per class, and two students in A + one in B. */
export async function world() {
  await resetDb();
  const roles: Record<string, number> = {};
  for (const name of ['ADMIN', 'MONITOR', 'STUDENT'] as const) roles[name] = (await prisma.role.create({ data: { name } })).id;
  const passwordHash = await argon2.hash(PW);
  const mkUser = (email: string, role: string) => prisma.user.create({ data: { email, fullName: email.split('@')[0], roleId: roles[role], passwordHash } });
  const year = await prisma.academicYear.create({ data: { name: 'Y1', startDate: new Date('2020-01-01'), endDate: new Date('2099-12-31'), isCurrent: true } });
  const A = await prisma.class.create({ data: { code: 'A', name: 'Class A', academicYearId: year.id } });
  const B = await prisma.class.create({ data: { code: 'B', name: 'Class B', academicYearId: year.id } });
  const admin = await mkUser('admin@t.test', 'ADMIN');
  const monA = await mkUser('monA@t.test', 'MONITOR'); const monB = await mkUser('monB@t.test', 'MONITOR');
  await prisma.classMonitor.create({ data: { userId: monA.id, classId: A.id } });
  await prisma.classMonitor.create({ data: { userId: monB.id, classId: B.id } });
  const mkStudent = async (n: string, classId: string) => {
    const u = await mkUser(`${n}@t.test`, 'STUDENT');
    return prisma.student.create({ data: { userId: u.id, studentCode: n.toUpperCase(), classes: { create: { classId } } } });
  };
  const s1 = await mkStudent('s1', A.id), s2 = await mkStudent('s2', A.id), s3 = await mkStudent('s3', B.id);
  return { A, B, admin, monA, monB, s1, s2, s3, year };
}

export async function login(email: string) {
  const r = await api().post('/api/auth/login').send({ email, password: PW });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  return { token: r.body.accessToken as string, auth: { Authorization: `Bearer ${r.body.accessToken}` } };
}
