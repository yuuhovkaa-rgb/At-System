import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/db';
import { PW, api, login, world } from './helpers';

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => { w = await world(); });

describe('authentication', () => {
  it('logs in with valid credentials and returns the role', async () => {
    const r = await api().post('/api/auth/login').send({ email: 'admin@t.test', password: PW });
    expect(r.status).toBe(200); expect(r.body.user.role).toBe('ADMIN'); expect(r.body.accessToken).toBeTruthy();
    expect(JSON.stringify(r.body)).not.toContain('passwordHash');
  });
  it('rejects wrong password and unknown e-mail with the same error', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'admin@t.test', password: 'nope' });
    const b = await api().post('/api/auth/login').send({ email: 'ghost@t.test', password: 'nope' });
    expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.body.error.code).toBe(b.body.error.code);
  });
  it('requires a token for protected routes', async () => { expect((await api().get('/api/auth/me')).status).toBe(401); });
  it('rejects forged tokens', async () => { expect((await api().get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401); });
  it('blocks deactivated accounts, including already-issued tokens', async () => {
    const { auth } = await login('s1@t.test');
    await prisma.user.update({ where: { id: w.s1.userId }, data: { isActive: false } });
    expect((await api().get('/api/auth/me').set(auth)).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 's1@t.test', password: PW })).status).toBe(403);
    await prisma.user.update({ where: { id: w.s1.userId }, data: { isActive: true } });
  });
  it('rotates refresh tokens and logout revokes them', async () => {
    const l = await api().post('/api/auth/login').send({ email: 'admin@t.test', password: PW });
    const cookie = l.headers['set-cookie'] as unknown as string[];
    const r1 = await api().post('/api/auth/refresh').set('Cookie', cookie);
    expect(r1.status).toBe(200);
    expect((await api().post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401); // old token reused
    await api().post('/api/auth/logout').set('Cookie', r1.headers['set-cookie'] as unknown as string[]);
    expect((await api().post('/api/auth/refresh').set('Cookie', r1.headers['set-cookie'] as unknown as string[])).status).toBe(401);
  });
  it('changes password only with the correct current password', async () => {
    const { auth } = await login('s2@t.test');
    expect((await api().post('/api/auth/change-password').set(auth).send({ currentPassword: 'wrong', newPassword: 'Newpass123' })).status).toBe(400);
    expect((await api().post('/api/auth/change-password').set(auth).send({ currentPassword: PW, newPassword: 'short' })).status).toBe(422);
    expect((await api().post('/api/auth/change-password').set(auth).send({ currentPassword: PW, newPassword: 'Newpass123' })).status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: 's2@t.test', password: 'Newpass123' })).status).toBe(200);
  });
  it('forgot-password does not reveal whether an account exists', async () => {
    const a = await api().post('/api/auth/forgot-password').send({ email: 'admin@t.test' });
    const b = await api().post('/api/auth/forgot-password').send({ email: 'ghost@t.test' });
    expect(a.status).toBe(200); expect(b.status).toBe(200); expect(a.body).toEqual(b.body);
  });
  it('rejects an invalid reset token', async () => {
    expect((await api().post('/api/auth/reset-password').send({ token: 'x'.repeat(40), newPassword: 'Newpass123' })).status).toBe(400);
  });
});
