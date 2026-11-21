import { ChevronLeft, ChevronRight, FileClock } from 'lucide-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PercentLine, StackedTrend, StatusPie } from '@/components/charts';
import { ScheduleList } from '@/components/Schedule';
import { DataTable, ErrorState, Field, Loading, Modal, PageHeader, Pagination, ProgressBar, StatCard, StatusBadge, StatusDot, Toolbar } from '@/components/ui';
import { useAction, useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/services/api';
import { Paged, Status, STATUSES } from '@/types';
import { fmtDate, pct } from '@/utils/format';

interface Rec { id: string; date: string; sessionNo: number; subject: string | null; className: string; status: Status; checkInTime: string | null; remarks: string | null }

function RequestModal({ rec, onClose }: { rec: Rec | null; onClose: () => void }) {
  const { t } = useTranslation(); const { run, busy } = useAction(); const [status, setStatus] = useState<Status>('EXCUSED'); const [reason, setReason] = useState('');
  return (
    <Modal open={!!rec} onClose={onClose} title={t('corrections.request')} footer={<><button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy || reason.length < 5} onClick={async () => { if (await run(() => api('/attendance/corrections', { body: { recordId: rec!.id, requestedStatus: status, reason } }), 'corrections.sent')) { setReason(''); onClose(); } }}>{t('common.submit')}</button></>}>
      <div className="space-y-4"><p className="text-sm">{fmtDate(rec?.date)} · {t('attendance.sessionNo', { n: rec?.sessionNo })} — <StatusBadge value={rec?.status ?? 'PRESENT'} /></p>
        <Field label={t('corrections.requestedStatus')}><select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>{STATUSES.filter((s) => s !== rec?.status).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></Field>
        <Field label={t('attendance.reason')} hint={t('corrections.reasonHint')}><textarea rows={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
    </Modal>
  );
}

export function MyAttendance() {
  const { t } = useTranslation(); const [range, setRange] = useState({ from: '', to: '' });
  const q = useApiQuery<any>('/student/me/statistics', range);
  if (q.isLoading) return <Loading />; if (q.errorMessage) return <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} />;
  const s = q.data.statistics;
  return (
    <>
      <PageHeader title={t('nav.myAttendance')} subtitle={t('student.statsSubtitle')} />
      <Toolbar><input type="date" className="input max-w-[160px]" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label={t('common.from')} /><input type="date" className="input max-w-[160px]" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label={t('common.to')} /><button className="btn-ghost" onClick={() => setRange({ from: '', to: '' })}>{t('common.reset')}</button></Toolbar>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5"><StatCard label={t('dashboard.totalSessions')} value={s.total} tone="slate" /><StatCard label={t('status.PRESENT')} value={s.present} tone="green" /><StatCard label={t('status.LATE')} value={s.late} tone="amber" /><StatCard label={t('status.ABSENT')} value={s.absent} tone="red" /><StatCard label={t('status.EXCUSED')} value={s.excused} tone="sky" /></div>
      <div className="mb-6 card p-5"><p className="text-sm text-slate-500">{t('dashboard.attendancePercentage')}</p><p className="mb-2 text-3xl font-bold">{pct(s.percentage)}</p><ProgressBar value={s.percentage} /></div>
      <div className="grid gap-6 lg:grid-cols-2"><div className="card p-5"><h2 className="mb-3 font-semibold">{t('student.monthly')}</h2><PercentLine data={q.data.monthly} xKey="month" /></div><div className="card p-5"><h2 className="mb-3 font-semibold">{t('dashboard.overallBreakdown')}</h2><StatusPie counts={s} /></div>
        <div className="card p-5 lg:col-span-2"><h2 className="mb-3 font-semibold">{t('student.monthlyCounts')}</h2><StackedTrend data={q.data.monthly} xKey="month" /></div></div>
    </>
  );
}

export function AttendanceHistory() {
  const { t } = useTranslation(); const [page, setPage] = useState(1); const [f, setF] = useState({ from: '', to: '', status: '' }); const [req, setReq] = useState<Rec | null>(null);
  const q = useApiQuery<Paged<Rec>>('/student/me/attendance', { page, pageSize: 15, ...f }); const upd = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setPage(1); };
  return (
    <>
      <PageHeader title={t('nav.history')} subtitle={t('student.historySubtitle')} />
      <Toolbar><input type="date" className="input max-w-[160px]" value={f.from} onChange={(e) => upd({ from: e.target.value })} aria-label={t('common.from')} /><input type="date" className="input max-w-[160px]" value={f.to} onChange={(e) => upd({ to: e.target.value })} aria-label={t('common.to')} />
        <select className="input max-w-[160px]" value={f.status} onChange={(e) => upd({ status: e.target.value })} aria-label={t('common.status')}><option value="">{t('common.all')}</option>{STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></Toolbar>
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[{ key: 'd', header: t('common.date'), render: (r) => fmtDate(r.date) }, { key: 's', header: t('common.session'), render: (r) => <>{r.sessionNo}{r.subject ? ` · ${r.subject}` : ''}</> }, { key: 'c', header: t('common.class'), render: (r) => r.className },
          { key: 'st', header: t('common.status'), render: (r) => <StatusBadge value={r.status} /> }, { key: 'ci', header: t('attendance.checkIn'), render: (r) => r.checkInTime ?? '—' }, { key: 'rm', header: t('common.remarks'), render: (r) => <span className="text-xs text-slate-500">{r.remarks ?? ''}</span> },
          { key: 'a', header: '', render: (r) => <button className="btn-ghost !p-1.5" aria-label={t('corrections.request')} onClick={() => setReq(r)}><FileClock className="h-4 w-4" /></button> }]}
        footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      <RequestModal rec={req} onClose={() => setReq(null)} />
    </>
  );
}

export function AttendanceCalendar() {
  const { t } = useTranslation(); const [month, setMonth] = useState(dayjs().startOf('month')); const [req, setReq] = useState<Rec | null>(null);
  const q = useApiQuery<{ items: Rec[] }>('/student/me/calendar', { month: month.format('YYYY-MM') });
  const byDate = new Map<string, Rec[]>(); q.data?.items.forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]));
  const lead = (month.day() + 6) % 7; const cells = [...Array(lead).fill(null), ...Array(month.daysInMonth()).keys()];
  return (
    <>
      <PageHeader title={t('nav.calendar')} subtitle={t('student.calendarSubtitle')} actions={<div className="flex items-center gap-2"><button className="btn-secondary !px-2" onClick={() => setMonth(month.subtract(1, 'month'))} aria-label={t('common.previous')}><ChevronLeft className="h-4 w-4" /></button><span className="min-w-[130px] text-center font-medium">{month.format('MMMM YYYY')}</span><button className="btn-secondary !px-2" onClick={() => setMonth(month.add(1, 'month'))} aria-label={t('common.next')}><ChevronRight className="h-4 w-4" /></button></div>} />
      <div className="card p-3 sm:p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 sm:gap-2">{[1, 2, 3, 4, 5, 6, 7].map((d) => <div key={d} className="py-1">{t(`daysShort.${d}`)}</div>)}</div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">{cells.map((c, i) => { if (c === null) return <div key={i} />; const key = month.date(c + 1).format('YYYY-MM-DD'); const recs = byDate.get(key) ?? [];
          return (<div key={i} className={`min-h-[56px] rounded-lg border p-1.5 sm:min-h-[84px] ${key === dayjs().format('YYYY-MM-DD') ? 'border-brand-500' : 'border-slate-200 dark:border-navy-700'}`}>
            <p className="text-xs text-slate-500">{c + 1}</p><div className="mt-1 flex flex-wrap gap-1">{recs.map((r) => <button key={r.id} title={`${t(`status.${r.status}`)} · ${r.className}`} aria-label={`${key} ${t(`status.${r.status}`)}`} onClick={() => setReq(r)} className="flex items-center gap-1 rounded px-1 text-[10px] hover:bg-slate-100 dark:hover:bg-navy-700"><StatusDot s={r.status} /><span className="hidden sm:inline">{t(`status.${r.status}`)}</span></button>)}</div></div>); })}</div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">{STATUSES.map((s) => <span key={s} className="flex items-center gap-1.5"><StatusDot s={s} />{t(`status.${s}`)}</span>)}</div>
      </div>
      <RequestModal rec={req} onClose={() => setReq(null)} />
    </>
  );
}

export function MySchedule() {
  const { t } = useTranslation(); const q = useApiQuery<{ items: any[] }>('/student/me/schedule');
  return (<><PageHeader title={t('nav.schedule')} subtitle={t('student.scheduleSubtitle')} />{q.isLoading ? <Loading /> : q.errorMessage ? <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} /> : <ScheduleList items={q.data!.items} />}</>);
}
