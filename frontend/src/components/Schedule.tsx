import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui';

export interface Slot { id: string; subject: string; dayOfWeek: number; sessionNo: number; startTime: string; endTime: string; room: string | null; className?: string }

/** Weekly timetable grouped by weekday. */
export function ScheduleList({ items, onDelete }: { items: Slot[]; onDelete?: (s: Slot) => void }) {
  const { t } = useTranslation();
  if (!items.length) return <EmptyState text={t('schedule.empty')} />;
  const jsDow = new Date().getDay() || 7;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => { const day = items.filter((i) => i.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime)); if (!day.length) return null;
        return (
          <div key={d} className={`card p-4 ${d === jsDow ? 'ring-2 ring-brand-500' : ''}`}>
            <h3 className="mb-2 flex items-center justify-between font-semibold">{t(`days.${d}`)}{d === jsDow && <span className="text-xs font-medium text-brand-600">{t('common.today')}</span>}</h3>
            <ul className="space-y-2">{day.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-2.5 text-sm dark:bg-navy-900">
                <div><p className="font-medium">{s.subject}</p><p className="text-xs text-slate-500">{s.startTime}–{s.endTime}{s.room ? ` · ${s.room}` : ''}{s.className ? ` · ${s.className}` : ''}</p></div>
                {onDelete && <button className="text-xs text-red-600 hover:underline" onClick={() => onDelete(s)}>{t('common.delete')}</button>}
              </li>))}</ul>
          </div>); })}
    </div>
  );
}
