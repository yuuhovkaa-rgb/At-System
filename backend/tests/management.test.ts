import { beforeAll, describe, expect, it } from 'vitest';
import { PW, api, login, world } from './helpers';

let w: Awaited<ReturnType<typeof world>>; let admin: any;
beforeAll(async () => { w = await world(); admin = (await login('admin@t.test')).auth; });

describe('student management', () => {
  it('creates, searches, updates and deactivates a student', async () => {
    const c = await api().post('/api/students').set(admin).send({ studentCode: 'NEW01', fullName: 'New Student', email: 'new@t.test', classId: w.A.id });
    expect(c.status).toBe(201); expect(c.body.temporaryPassword).toBeTruthy();
    const id = c.body.student.id;
    expect((await api().get('/api/students?q=new student').set(admin)).body.items.map((s: any) => s.id)).toContain(id);
    expect((await api().get(`/api/students?classId=${w.A.id}`).set(admin)).body.items.length).toBe(3);
    expect((await api().put(`/api/students/${id}`).set(admin).send({ studentCode: 'NEW01', fullName: 'Renamed', email: 'new@t.test' })).body.student.fullName).toBe('Renamed');
    expect((await api().delete(`/api/students/${id}`).set(admin)).status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: 'new@t.test', password: c.body.temporaryPassword })).status).toBe(403);
  });
  it('rejects duplicate student codes and e-mails', async () => {
    const r = await api().post('/api/students').set(admin).send({ studentCode: 'S1', fullName: 'Dup', email: 'dup@t.test' });
    expect(r.status).toBe(409);
  });
  it('imports CSV rows and reports invalid ones', async () => {
    const csv = 'studentCode,fullName,email,gender,phone,classCode\nIMP1,Import One,imp1@t.test,F,012345,A\nIMP2,,bad,,,\nIMP3,Import Three,imp3@t.test,,,ZZZ\n';
    const r = await api().post('/api/students/import').set(admin).attach('file', Buffer.from(csv), 'students.csv');
    expect(r.status).toBe(200); expect(r.body.created).toBe(1); expect(r.body.failed).toBe(2);
  });
  it('exports students as CSV', async () => {
    const r = await api().get('/api/students/export?format=csv').set(admin);
    expect(r.status).toBe(200); expect(r.headers['content-type']).toContain('text/csv'); expect(r.text).toContain('S1');
  });
  it('writes audit log entries for changes', async () => {
    const r = await api().get('/api/admin/audit-logs?action=CREATE_STUDENT').set(admin);
    expect(r.body.items.length).toBeGreaterThan(0);
  });
});

describe('class and monitor management', () => {
  it('creates a class, assigns students, archives it', async () => {
    const c = await api().post('/api/classes').set(admin).send({ code: 'C', name: 'Class C', academicYearId: w.year.id });
    expect(c.status).toBe(201);
    expect((await api().post(`/api/classes/${c.body.class.id}/students`).set(admin).send({ studentIds: [w.s1.id, w.s2.id] })).body.added).toBe(2);
    expect((await api().get(`/api/classes/${c.body.class.id}`).set(admin)).body.class.students).toHaveLength(2);
    expect((await api().delete(`/api/classes/${c.body.class.id}`).set(admin)).status).toBe(200);
    expect((await api().get('/api/classes?archived=true').set(admin)).body.items.map((x: any) => x.code)).toContain('C');
  });
  it('creates a monitor account that can only manage its class', async () => {
    const m = await api().post('/api/monitors').set(admin).send({ fullName: 'New Monitor', email: 'nm@t.test', classId: w.B.id, password: PW });
    expect(m.status).toBe(201);
    const { auth } = await login('nm@t.test');
    expect((await api().get(`/api/classes/${w.A.id}`).set(auth)).status).toBe(403);
    expect((await api().get(`/api/classes/${w.B.id}`).set(auth)).status).toBe(200);
    await api().put(`/api/monitors/${m.body.monitor.id}`).set(admin).send({ fullName: 'New Monitor', classId: w.B.id, isActive: false });
    expect((await api().get('/api/auth/me').set(auth)).status).toBe(401);
  });
  it('updates system settings with validation', async () => {
    expect((await api().put('/api/settings').set(admin).send({ excusedPolicy: 'COUNT_AS_PRESENT', lateAfterMinutes: 10 })).body.settings.excusedPolicy).toBe('COUNT_AS_PRESENT');
    expect((await api().put('/api/settings').set(admin).send({ timezone: 'Mars/Base' })).status).toBe(422);
    await api().put('/api/settings').set(admin).send({ excusedPolicy: 'EXCLUDE', lateAfterMinutes: 15 });
  });
});
