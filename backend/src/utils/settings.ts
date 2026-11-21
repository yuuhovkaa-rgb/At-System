import { prisma } from '../config/db';
import { ExcusedPolicy } from './stats';

export interface Settings {
  schoolName: string;
  timezone: string;
  excusedPolicy: ExcusedPolicy;
  lateCountsAsPresent: boolean;
  lateAfterMinutes: number; // check-in later than session start + N minutes => LATE
  minAttendancePercent: number; // below this a student is flagged "at risk"
  languages: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  schoolName: 'AT System School',
  timezone: 'Asia/Phnom_Penh',
  excusedPolicy: 'EXCLUDE',
  lateCountsAsPresent: true,
  lateAfterMinutes: 15,
  minAttendancePercent: 80,
  languages: ['en', 'kh'],
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.systemSetting.findMany();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as Settings;
}

export async function saveSettings(patch: Partial<Settings>) {
  await prisma.$transaction(
    Object.entries(patch).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: value as never },
        create: { key, value: value as never },
      }),
    ),
  );
}
