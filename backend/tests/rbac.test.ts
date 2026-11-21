import { beforeAll, describe, expect, it } from 'vitest';
import { api, login, world } from './helpers';

let w: Awaited<ReturnType<typeof world>>;
let admin: any, monA: any, monB: any, s1: any;
beforeAll(async () => { w = await world(); admin = (await login('admin@t.test')).auth; monA = (await login('monA@t.test')).auth; monB = (await login('monB@t.test')).auth; s1 = (await login('s1@t.test')).auth; });

describe('role-based access control', () => {
  it('students cannot reach admin or monitor endpoints', async () => {
    for (const path of ['/api/admin/dashboard', '/api/admin/users', '/api/admin/audit-logs', '/api/students', '/api/monitors', '/api/attendance/sessions', '/api/monitor/dashboard'])
      expect((await api().get(path).set(s1)).status, path).toBe(403);
  });
  it('monitors cannot reach admin endpoints or admin mutations', async () => {
    expect((await api().get('/api/admin/dashboard').set(monA)).status).toBe(403);
    expect((await api().get('/api/monitors').set(monA)).status).toBe(403);
    expect((await api().post('/api/admin/users').set(monA).send({ fullName: 'Evil', email: 'e@t.test' })).status).toBe(403);
    expect((await api().post('/api/classes').set(monA).send({})).status).toBe(403);
    expect((await api().put('/api/settings').set(monA).send({ schoolName: 'x' })).status).toBe(403);
  });
  it('admin can access everything admin-only', async () => {
    expect((await api().get('/api/admin/dashboard').set(admin)).status).toBe(200);
    expect((await api().get('/api/admin/audit-logs').set(admin)).status).toBe(200);
  });
  it('a student cannot read another student by changing the id in the URL (privacy)', async () => {
    expect((await api().get(`/api/students/${w.s1.id}`).set(s1)).status).toBe(200);
    expect((await api().get(`/api/students/${w.s2.id}`).set(s1)).status).toBe(403);
    expect((await api().get(`/api/students/${w.s3.id}`).set(s1)).status).toBe(403);
  });
  it('a monitor only sees students and the class they are assigned to', async () => {
    const list = await api().get('/api/students').set(monA);
    expect(list.body.items.map((s: any) => s.studentCode).sort()).toEqual(['S1', 'S2']);
    expect((await api().get(`/api/students/${w.s3.id}`).set(monA)).status).toBe(403);
    expect((await api().get(`/api/classes/${w.B.id}`).set(monA)).status).toBe(403);
    expect((await api().get(`/api/classes/${w.A.id}`).set(monA)).status).toBe(200);
    expect((await api().get('/api/classes').set(monA)).body.items).toHaveLength(1);
  });
  it('a monitor cannot filter reports or sessions onto a foreign class', async () => {
    expect((await api().get(`/api/attendance/reports?classId=${w.B.id}`).set(monA)).status).toBe(403);
    expect((await api().get(`/api/attendance/sessions?classId=${w.B.id}`).set(monA)).body.items).toHaveLength(0);
    expect((await api().post('/api/attendance/sessions').set(monA).send({ classId: w.B.id, date: '2024-01-02' })).status).toBe(201); // classId is ignored: forced to A
    const s = await api().get('/api/attendance/sessions').set(monB);
    expect(s.body.items).toHaveLength(0);
  });
  it('student portal returns only the caller\'s data', async () => {
    const r = await api().get('/api/student/me/attendance').set(s1);
    expect(r.status).toBe(200);
    expect((await api().get('/api/student/me/attendance').set(admin)).status).toBe(403);
  });
  it('rejects invalid input with a validation error', async () => {
    const r = await api().post('/api/students').set(admin).send({ studentCode: 'x', fullName: '', email: 'bad' });
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
});
