import { z } from 'zod';

export const password = z
  .string()
  .min(8, 'PASSWORD_TOO_SHORT')
  .max(100)
  .regex(/[A-Za-z]/, 'PASSWORD_NEEDS_LETTER')
  .regex(/[0-9]/, 'PASSWORD_NEEDS_DIGIT');
export const email = z.string().trim().toLowerCase().email().max(200);
export const status = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);
export const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'INVALID_TIME');
export const id = z.string().min(1).max(60);
