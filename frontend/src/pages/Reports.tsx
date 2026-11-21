import { Download } from 'lucide-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HBars, PercentLine, StackedTrend, StatusPie } from '@/components/charts';
import { DataTable, ErrorState, Loading, PageHeader, ProgressBar, StatCard, Toolbar } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApiQuery } from '@/hooks/useApiQuery';
import { download } from '@/services/api';
import { AcademicYear, ClassRow, Paged, StudentRow } from '@/types';
import { errMsg } from '@/utils/errors';
import { pct } from '@/utils/format';
import { CalendarCheck, CheckCircle2, Clock, UserX } from 'lucide-react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="card p-5"><h2 className="mb-3 font-semibold">{title}</h2>{children}</div>;

function useFilters(extra: Record<string, string> = {}) {
  const [f, setF] = useState({ from: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD'), classId: '', studentId: '', status: '', academicYearId: '', semesterId: '', period: 'day', ...extra });
  return [f, (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))] as const;
}

function YearSemester({ f, set }: { f: { academicYearId: string; semesterId: string }; set: (p: any) => void }) {
  const { t } = useTranslation(); const years = useApiQuery<{ items: AcademicYear[] }>('/academic-years');
  const sems = years.data?.items.find((y) => y.id === f.academicYearId)?.semesters ?? [];
  return (<>
    <select className="input max-w-[170px]" value={f.academicYearId} onChange={(e) => set({ academicYearId: e.target.value, semesterId: '' })} aria-label={t('settings.academicYear')}><option value="">{t('settings.academicYear')}</option>{years.data?.items.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
    <select className="input max-w-[150px]" value={f.semesterId} onChange={(e) => set({ semesterId: e.target.value })} disabled={!sems.length} aria-label={t('settings.semester')}><option value="">{t('settings.semester')}</option>{sems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></>);
}

export function ReportsPage() {
  const { t } = useTranslation(); const { user } = useAuth(); const toast = useToast(); const admin = user!.role === 'ADMIN';
  const canExport = admin || user!.permissions?.canExportReports; const [f, set] = useFilters();
  const classes = useApiQuery<Paged<ClassRow>>('/classes', { pageSize: 100 }, { enabled: admin }); const students = useApiQuery<Paged<StudentRow>>('/students', { pageSize: 100, classId: f.classId });
  const q = useApiQuery<any>('/attendance/reports', f);
  const exp = async (format: string) => { try { await download('/attendance/reports/export', { ...f, format }, `report.${format}`); } catch (e) { toast(errMsg(e, t), 'error'); } };
  return (
    <>
      <PageHeader title={t('nav.reports')} subtitle={t('reports.subtitle')} actions={canExport && <>{['csv', 'xlsx', 'pdf'].map((x) => <button key={x} className="btn-secondary" onClick={() => exp(x)}><Download className="h-4 w-4" />{x.toUpperCase()}</button>)}</>} />
      <Toolbar>
        <input type="date" className="input max-w-[160px]" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label={t('common.from')} /><input type="date" className="input max-w-[160px]" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label={t('common.to')} />
        {admin && <select className="input max-w-[200px]" value={f.classId} onChange={(e) => set({ classId: e.target.value, studentId: '' })} aria-label={t('common.class')}><option value="">{t('common.allClasses')}</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <select className="input max-w-[200px]" value={f.studentId} onChange={(e) => set({ studentId: e.target.value })} aria-label={t('common.student')}><option value="">{t('common.allStudents')}</option>{students.data?.items.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select>
        <select className="input max-w-[140px]" value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label={t('common.status')}><option value="">{t('common.all')}</option>{['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select>
        <select className="input max-w-[130px]" value={f.period} onChange={(e) => set({ period: e.target.value })} aria-label={t('common.period')}>{['day', 'week', 'month'].map((p) => <option key={p} value={p}>{t(`common.${p}`)}</option>)}</select>
        <YearSemester f={f} set={set} /></Toolbar>
      {q.isLoading ? <Loading /> : q.errorMessage ? <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} /> : (() => { const d = q.data; return (<>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label={t('dashboard.attendancePercentage')} value={pct(d.summary.percentage)} tone="brand" icon={<CalendarCheck className="h-5 w-5" />} />
          <StatCard label={t('status.PRESENT')} value={d.summary.present} tone="green" icon={<CheckCircle2 className="h-5 w-5" />} /><StatCard label={t('status.LATE')} value={d.summary.late} tone="amber" icon={<Clock className="h-5 w-5" />} />
          <StatCard label={t('status.ABSENT')} value={d.summary.absent} tone="red" icon={<UserX className="h-5 w-5" />} /><StatCard label={t('status.EXCUSED')} value={d.summary.excused} tone="sky" /></div>
        <div className="mb-6 grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2"><Section title={t('reports.trend')}><StackedTrend data={d.trend} xKey="period" /></Section></div><Section title={t('dashboard.overallBreakdown')}><StatusPie counts={d.summary} /></Section></div>
        <p className="mb-2 text-xs text-slate-500">{t('reports.rules', { policy: t(`settings.policy.${d.rules.excusedPolicy}`) })}</p>
        <h2 className="mb-2 font-semibold">{t('reports.perStudent')}</h2>
        <DataTable rows={d.students} rowKey={(r: any) => r.studentId} columns={[
          { key: 'c', header: t('students.code'), render: (r: any) => <span className="font-mono text-xs">{r.studentCode}</span> }, { key: 'n', header: t('common.name'), render: (r: any) => r.fullName },
          { key: 'p', header: t('status.PRESENT'), render: (r: any) => r.present }, { key: 'l', header: t('status.LATE'), render: (r: any) => r.late }, { key: 'a', header: t('status.ABSENT'), render: (r: any) => r.absent }, { key: 'e', header: t('status.EXCUSED'), render: (r: any) => r.excused },
          { key: 'pc', header: t('common.percentage'), render: (r: any) => <div className="flex min-w-[130px] items-center gap-2"><div className="w-20"><ProgressBar value={r.percentage} /></div><span className="text-xs tabular-nums">{pct(r.percentage)}</span>{r.atRisk && <span className="rounded bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">{t('reports.atRisk')}</span>}</div> }]} />
      </>); })()}
    </>
  );
}

export function AnalyticsPage() {
  const { t } = useTranslation(); const [f, set] = useFilters({ from: dayjs().subtract(6, 'month').format('YYYY-MM-DD') });
  const classes = useApiQuery<Paged<ClassRow>>('/classes', { pageSize: 100 }); const q = useApiQuery<any>('/admin/analytics', { from: f.from, to: f.to, classId: f.classId, academicYearId: f.academicYearId, semesterId: f.semesterId });
  return (
    <>
      <PageHeader title={t('nav.analytics')} subtitle={t('analytics.subtitle')} />
      <Toolbar><input type="date" className="input max-w-[160px]" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label={t('common.from')} /><input type="date" className="input max-w-[160px]" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label={t('common.to')} />
        <select className="input max-w-[200px]" value={f.classId} onChange={(e) => set({ classId: e.target.value })}><option value="">{t('common.allClasses')}</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><YearSemester f={f} set={set} /></Toolbar>
      {q.isLoading ? <Loading /> : q.errorMessage ? <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} /> : (() => { const d = q.data; return (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title={t('analytics.monthlyTrend')}><PercentLine data={d.trend} xKey="period" /></Section>
          <Section title={t('analytics.presentVsAbsent')}><StackedTrend data={d.trend} xKey="period" /></Section>
          <Section title={t('analytics.classComparison')}><HBars data={d.classes} nameKey="name" valueKey="percentage" unit="%" /></Section>
          <Section title={t('analytics.lateByClass')}><HBars data={d.classes} nameKey="name" valueKey="late" color="#f59e0b" /></Section>
          <Section title={t('analytics.topAbsent')}><HBars data={d.topAbsent} nameKey="fullName" valueKey="absent" color="#dc2626" /></Section>
          <Section title={`${t('analytics.atRisk')} (${d.atRisk.length})`}>{!d.atRisk.length ? <p className="py-8 text-center text-sm text-slate-400">{t('common.noData')}</p> : <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-navy-700">{d.atRisk.map((s: any) => <li key={s.studentId} className="flex justify-between py-2 text-sm"><span>{s.fullName}</span><span className="font-semibold text-red-600">{pct(s.percentage)}</span></li>)}</ul>}</Section>
        </div>); })()}
    </>
  );
}
