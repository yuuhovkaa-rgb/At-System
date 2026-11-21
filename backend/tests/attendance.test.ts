import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/db';
import { api, login, world } from './helpers';

let w: Awaited<ReturnType<typeof world>>;
let admin: any, monA: any, monB: any, s1: any, s2: any, sessionId: string, rec1: string;
const D = '2024-03-04';

beforeAll(async () => {
  w = await world();
  admin = (await login('admin@t.test')).auth; monA = (await login('monA@t.test')).auth; monB = (await login('monB@t.test')).auth;
  s1 = (await login('s1@t.test')).auth; s2 = (await login('s2@t.test')).auth;
});

describe('attendance workflow', () => {
  it('creates a session and prevents duplicates for the same class/date/session', async () => {
    const r = await api().post('/api/attendance/sessions').set(monA).send({ date: D, sessionNo: 1, startTime: '08:00' });
    expect(r.status).toBe(201); sessionId = r.body.session.id;
    const dup = await api().post('/api/attendance/sessions').set(monA).send({ date: D, sessionNo: 1 });
    expect(dup.status).toBe(409); expect(dup.body.error.code).toBe('DUPLICATE_SESSION');
    expect((await api().post('/api/attendance/sessions').set(monA).send({ date: D, sessionNo: 2 })).status).toBe(201); // multiple sessions per day
  });
  it('refuses sessions in the future', async () => {
    expect((await api().post('/api/attendance/sessions').set(monA).send({ date: '2999-01-01' })).status).toBe(400);
  });
  it('another class monitor cannot open or write to the session', async () => {
    expect((await api().get(`/api/attendance/sessions/${sessionId}`).set(monB)).status).toBe(403);
    expect((await api().post(`/api/attendance/sessions/${sessionId}/records`).set(monB).send({ records: [{ studentId: w.s1.id, status: 'PRESENT' }] })).status).toBe(403);
  });
  it('saves records, applies the late rule and does not auto-mark unrecorded students', async () => {
    const r = await api().post(`/api/attendance/sessions/${sessionId}/records`).set(monA).send({ records: [{ studentId: w.s1.id, status: 'PRESENT', checkInTime: '08:30' }] });
    expect(r.status).toBe(200); expect(r.body.counts).toMatchObject({ late: 1, absent: 0 });
    const d = await api().get(`/api/attendance/sessions/${sessionId}`).set(monA);
    expect(d.body.students.find((s: any) => s.studentId === w.s2.id).record).toBeNull(); // still unrecorded
    rec1 = d.body.students.find((s: any) => s.studentId === w.s1.id).record.id;
  });
  it('rejects students from other classes and duplicate entries in one request', async () => {
    expect((await api().post(`/api/attendance/sessions/${sessionId}/records`).set(monA).send({ records: [{ studentId: w.s3.id, status: 'PRESENT' }] })).status).toBe(400);
    expect((await api().post(`/api/attendance/sessions/${sessionId}/records`).set(monA).send({ records: [{ studentId: w.s1.id, status: 'PRESENT' }, { studentId: w.s1.id, status: 'ABSENT' }] })).status).toBe(400);
  });
  it('students cannot see attendance of unsubmitted sessions', async () => {
    expect((await api().get('/api/student/me/attendance').set(s1)).body.items).toHaveLength(0);
  });
  it('editing before submission is allowed and audited', async () => {
    expect((await api().put(`/api/attendance/records/${rec1}`).set(monA).send({ status: 'PRESENT', checkInTime: '08:05' })).body.record.status).toBe('PRESENT');
    const logs = await prisma.auditLog.findMany({ where: { entity: 'AttendanceRecord', entityId: rec1 } });
    expect(logs.length).toBeGreaterThan(0); expect(logs[0].before).toBeTruthy();
  });
  it('submit locks the session and auto-marks unrecorded students absent', async () => {
    const r = await api().post(`/api/attendance/sessions/${sessionId}/submit`).set(monA);
    expect(r.status).toBe(200); expect(r.body.autoMarkedAbsent).toBe(1);
    expect((await api().post(`/api/attendance/sessions/${sessionId}/submit`).set(monA)).status).toBe(423);
    expect((await api().post(`/api/attendance/sessions/${sessionId}/records`).set(monA).send({ records: [{ studentId: w.s1.id, status: 'ABSENT' }] })).status).toBe(423);
  });
  it('a monitor cannot silently modify a locked record; admin can, with a reason', async () => {
    expect((await api().put(`/api/attendance/records/${rec1}`).set(monA).send({ status: 'ABSENT' })).status).toBe(423);
    expect((await api().put(`/api/attendance/records/${rec1}`).set(admin).send({ status: 'EXCUSED' })).status).toBe(400);
    expect((await api().put(`/api/attendance/records/${rec1}`).set(admin).send({ status: 'EXCUSED', reason: 'medical note' })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'ADMIN_CORRECT_ATTENDANCE', entityId: rec1 } })).toBe(1);
    await api().put(`/api/attendance/records/${rec1}`).set(admin).send({ status: 'PRESENT', reason: 'revert' });
  });
  it('students see their own submitted attendance and statistics', async () => {
    const a = await api().get('/api/student/me/attendance').set(s2);
    expect(a.body.items).toHaveLength(1); expect(a.body.items[0].status).toBe('ABSENT');
    const st = await api().get('/api/student/me/statistics').set(s2);
    expect(st.body.statistics).toMatchObject({ absent: 1, present: 0, percentage: 0 });
    const own = await api().get('/api/student/me/statistics').set(s1);
    expect(own.body.statistics.percentage).toBe(100);
  });
});

describe('attendance corrections', () => {
  let reqId: string, rec2: string;
  beforeAll(async () => { rec2 = (await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId: w.s2.id } })).id; });
  it('a student can only request a correction for their own record', async () => {
    expect((await api().post('/api/attendance/corrections').set(s1).send({ recordId: rec2, requestedStatus: 'EXCUSED', reason: 'I was sick actually' })).status).toBe(403);
    const r = await api().post('/api/attendance/corrections').set(s2).send({ recordId: rec2, requestedStatus: 'EXCUSED', reason: 'I was sick, certificate attached' });
    expect(r.status).toBe(201); reqId = r.body.request.id;
    expect((await api().post('/api/attendance/corrections').set(s2).send({ recordId: rec2, requestedStatus: 'LATE', reason: 'second request' })).status).toBe(409);
  });
  it('requests are visible only to the requester, the class monitor and admins', async () => {
    expect((await api().get('/api/attendance/corrections').set(s1)).body.items).toHaveLength(0);
    expect((await api().get('/api/attendance/corrections').set(monA)).body.items).toHaveLength(1);
    expect((await api().get('/api/attendance/corrections').set(monB)).body.items).toHaveLength(0);
    expect((await api().post(`/api/attendance/corrections/${reqId}/review`).set(monB).send({ decision: 'APPROVED' })).status).toBe(403);
  });
  it('approving updates the record, notifies and is audited', async () => {
    expect((await api().post(`/api/attendance/corrections/${reqId}/review`).set(monA).send({ decision: 'APPROVED', note: 'ok' })).status).toBe(200);
    expect((await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: rec2 } })).status).toBe('EXCUSED');
    expect(await prisma.auditLog.count({ where: { action: 'APPROVE_CORRECTION', entityId: rec2 } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: w.s2.userId, type: 'correction_approved' } })).toBeGreaterThan(0);
    expect((await api().post(`/api/attendance/corrections/${reqId}/review`).set(admin).send({ decision: 'REJECTED' })).status).toBe(409);
  });
  it('a monitor cannot approve a monitor-raised request (admin only)', async () => {
    const r = await api().post('/api/attendance/corrections').set(monA).send({ recordId: rec2, requestedStatus: 'ABSENT', reason: 'Wrong, was absent' });
    expect(r.status).toBe(201);
    expect((await api().post(`/api/attendance/corrections/${r.body.request.id}/review`).set(monA).send({ decision: 'APPROVED' })).status).toBe(403);
    expect((await api().post(`/api/attendance/corrections/${r.body.request.id}/review`).set(admin).send({ decision: 'APPROVED' })).status).toBe(200);
  });
});

describe('reports', () => {
  it('builds a report scoped to the monitor class and exports CSV/XLSX/PDF', async () => {
    const r = await api().get(`/api/attendance/reports?from=2024-01-01&to=2024-12-31`).set(monA);
    expect(r.status).toBe(200); expect(r.body.summary.total).toBe(2); expect(r.body.students).toHaveLength(2);
    for (const [fmt, type] of [['csv', 'text/csv'], ['xlsx', 'spreadsheetml'], ['pdf', 'application/pdf']])
      { const x = await api().get(`/api/attendance/reports/export?from=2024-01-01&to=2024-12-31&format=${fmt}`).set(monA).buffer(true); expect(x.status, fmt).toBe(200); expect(x.headers['content-type']).toContain(type); }
  });
  it('students cannot use reports', async () => { expect((await api().get('/api/attendance/reports').set(s1)).status).toBe(403); });
});
