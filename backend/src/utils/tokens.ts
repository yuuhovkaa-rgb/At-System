import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export function randomPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len - 2; i++) out += chars[crypto.randomInt(chars.length)];
  return out + crypto.randomInt(2, 10) + 'a'; // always contains a digit and a letter
}

export const signAccess = (userId: string) =>
  jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
export const signRefresh = (userId: string) =>
  jwt.sign({ sub: userId, jti: randomToken(8) }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
export const verifyAccess = (t: string) => jwt.verify(t, env.JWT_ACCESS_SECRET) as { sub: string };
export const verifyRefresh = (t: string) => jwt.verify(t, env.JWT_REFRESH_SECRET) as { sub: string };
