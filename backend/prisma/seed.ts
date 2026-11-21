/* Seed: demo school with 3 classes, 36 students, 3 monitors, 1 admin and ~4 weeks of attendance history.
   WARNING: wipes all existing data first. Run with `npm run seed`. */
import argon2 from 'argon2';
import { PrismaClient, AttendanceStatus } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(tz);

const prisma = new PrismaClient();
const TZ = 'Asia/Phnom_Penh';

export const DEMO = {
  admin: { email: 'admin@atsystem.test', password: 'Admin@12345' },
  monitor: { email: 'monitor1@atsystem.test', password: 'Monitor@12345' }, // monitor1..3
  student: { email: 'student1@atsystem.test', password: 'Student@12345' }, // student1..36
};

// Deterministic pseudo-random so the demo data is reproducible.
let seed = 20260101;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const first = ['Sokha', 'Dara', 'Vanna', 'Sreymom', 'Rithy', 'Chantha', 'Pisey', 'Bopha', 'Sovann', 'Kimheng', 'Nary', 'Veasna'];
const last = ['Chan', 'Kem', 'Sok', 'Lim', 'Heng', 'Ouk', 'Pich', 'Seng', 'Meas', 'Chea'];
const khmerNames = ['សុខា ចាន់', 'ដារ៉ា កែម', 'វណ្ណា សុខ', 'ស្រីមុំ លឹម', 'រិទ្ធី ហេង', 'ច័ន្ទា អ៊ុក', 'ពិសី ពេជ្រ', 'បុប្ផា សេង', 'សុវណ្ណ មាស', 'គឹមហេង ជា', 'នារី ចាន់', 'វាសនា កែម'];

async function main() {
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) { console.log('Database already has data – seed skipped.'); return; }
  await prisma.$transaction([
    prisma.notification.deleteMany(), prisma.auditLog.deleteMany(), prisma.attendanceCorrectionRequest.deleteMany(),
    prisma.attendanceRecord.deleteMany(), prisma.attendanceSession.deleteMany(), prisma.announcement.deleteMany(),
    prisma.classSession.deleteMany(), prisma.classMonitor.deleteMany(), prisma.classStudent.deleteMany(), prisma.student.deleteMany(),
    prisma.class.deleteMany(), prisma.semester.deleteMany(), prisma.academicYear.deleteMany(), prisma.user.deleteMany(),
    prisma.role.deleteMany(), prisma.systemSetting.deleteMany(),
  ]);

  const roles = Object.fromEntries(await Promise.all((['ADMIN', 'MONITOR', 'STUDENT'] as const).map(async (name) =>
    [name, await prisma.role.create({ data: { name, description: `${name} role` } })] as const)));
  const hash = { ADMIN: await argon2.hash(DEMO.admin.password), MONITOR: await argon2.hash(DEMO.monitor.password), STUDENT: await argon2.hash(DEMO.student.password) };

  await prisma.systemSetting.createMany({ data: [
    { key: 'schoolName', value: 'Phnom Penh Demo University' }, { key: 'timezone', value: TZ },
    { key: 'excusedPolicy', value: 'EXCLUDE' }, { key: 'lateCountsAsPresent', value: true },
    { key: 'lateAfterMinutes', value: 15 }, { key: 'minAttendancePercent', value: 80 },
  ] });

  const today = dayjs().tz(TZ).startOf('day');
  const year = await prisma.academicYear.create({ data: { name: `${today.year()} Academic Year`, startDate: new Date(`${today.year()}-01-01`), endDate: new Date(`${today.year()}-12-31`), isCurrent: true } });
  const sem = await prisma.semester.create({ data: { academicYearId: year.id, name: 'Semester 2', startDate: new Date(`${today.year()}-07-01`), endDate: new Date(`${today.year()}-12-31`), isCurrent: true } });

  await prisma.user.create({ data: { email: DEMO.admin.email, fullName: 'System Administrator', roleId: roles.ADMIN.id, passwordHash: hash.ADMIN } });

  const classDefs = [
    { code: 'CS-101', name: 'Computer Science Year 1 – A', subj: ['Programming Fundamentals', 'Mathematics'] },
    { code: 'CS-102', name: 'Computer Science Year 1 – B', subj: ['Database Systems', 'English'] },
    { code: 'IT-201', name: 'Information Technology Year 2', subj: ['Networking', 'Web Development'] },
  ];
  let studentNo = 0;
  for (const [ci, def] of classDefs.entries()) {
    const cls = await prisma.class.create({ data: { code: def.code, name: def.name, academicYearId: year.id, semesterId: sem.id } });
    const monitorUser = await prisma.user.create({ data: { email: `monitor${ci + 1}@atsystem.test`, fullName: `${first[ci + 3]} ${last[ci]} (Monitor)`, roleId: roles.MONITOR.id, passwordHash: hash.MONITOR, language: ci === 2 ? 'kh' : 'en' } });
    await prisma.classMonitor.create({ data: { userId: monitorUser.id, classId: cls.id } });
    for (let d = 1; d <= 5; d++) for (const [i, s] of def.subj.entries())
      await prisma.classSession.create({ data: { classId: cls.id, subject: s, dayOfWeek: d, sessionNo: i + 1, startTime: i === 0 ? '08:00' : '10:00', endTime: i === 0 ? '09:30' : '11:30', room: `R-${100 + ci * 10 + d}` } });

    const students: { id: string; rate: number }[] = [];
    for (let i = 0; i < 12; i++) {
      studentNo++;
      const khmer = i < 6 && ci === 2 ? khmerNames[i] : null; // some Khmer-script names to exercise Unicode
      const u = await prisma.user.create({ data: { email: `student${studentNo}@atsystem.test`, fullName: khmer ?? `${first[i]} ${last[(i + ci) % last.length]}`, roleId: roles.STUDENT.id, passwordHash: hash.STUDENT } });
      const s = await prisma.student.create({ data: { userId: u.id, studentCode: `S${today.year()}${String(studentNo).padStart(3, '0')}`, gender: i % 2 ? 'F' : 'M', phone: `0${12 + i}${String(100000 + studentNo * 137).slice(0, 6)}`, classes: { create: { classId: cls.id } } } });
      students.push({ id: s.id, rate: i === 4 ? 0.62 : i === 9 ? 0.7 : 0.82 + rnd() * 0.17 }); // two at-risk students per class
    }

    // ~4 weeks of submitted history (weekdays only), today's first session left OPEN for the monitor to practise.
    let day = today;
    for (let n = 0; n < 28; n++, day = day.subtract(1, 'day')) {
      if (day.day() === 0 || day.day() === 6) continue;
      for (const [si, start] of ['08:00', '10:00'].entries()) {
        const isToday = n === 0;
        if (si === 1 && ci !== 0) continue; // only class A has two sessions per day
        const session = await prisma.attendanceSession.create({ data: { classId: cls.id, date: new Date(day.format('YYYY-MM-DD')), sessionNo: si + 1, subject: def.subj[si], startTime: start,
          status: isToday ? 'OPEN' : 'SUBMITTED', createdById: monitorUser.id, submittedById: isToday ? null : monitorUser.id, submittedAt: isToday ? null : day.add(18, 'hour').toDate() } });
        if (isToday) continue; // nothing recorded yet today
        await prisma.attendanceRecord.createMany({ data: students.map((st): any => {
          const r = rnd(); let status: AttendanceStatus = 'PRESENT';
          if (r > st.rate) status = rnd() < 0.18 ? 'EXCUSED' : 'ABSENT'; else if (rnd() < 0.07) status = 'LATE';
          return { sessionId: session.id, studentId: st.id, status, recordedById: monitorUser.id,
            checkInTime: status === 'LATE' ? start.replace(/..$/, '25') : status === 'PRESENT' ? start.replace(/..$/, '0' + Math.floor(rnd() * 8)) : null,
            remarks: status === 'EXCUSED' ? 'Medical certificate' : null };
        }) });
      }
    }
    await prisma.announcement.create({ data: { title: `Welcome to ${def.name}`, body: 'Please arrive on time. Attendance is taken at the start of every session.', authorId: monitorUser.id, classId: cls.id } });
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: DEMO.admin.email } });
  await prisma.announcement.create({ data: { title: 'Semester attendance policy', body: 'Students must keep attendance at or above 80%. Contact your class monitor for corrections within one week.', authorId: admin.id } });
  console.log('Seed complete.\n  Admin:   %s / %s\n  Monitor: monitor1..3@atsystem.test / %s\n  Student: student1..36@atsystem.test / %s', DEMO.admin.email, DEMO.admin.password, DEMO.monitor.password, DEMO.student.password);
}
main().finally(() => prisma.$disconnect());
