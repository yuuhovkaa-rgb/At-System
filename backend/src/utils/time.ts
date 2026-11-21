import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(tz);

/** Today's calendar date (YYYY-MM-DD) in the configured school timezone. */
export const todayIn = (timezone: string) => dayjs().tz(timezone).format('YYYY-MM-DD');
/** "YYYY-MM-DD" -> Date at UTC midnight (what Prisma stores for @db.Date). */
export const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const isoDow = (s: string) => ((new Date(`${s}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
export { dayjs };
