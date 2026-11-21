import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, FileClock, GraduationCap, School, ShieldCheck, UserCog, UserX, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HBars, StackedTrend, StatusPie } from '@/components/charts';
import { ErrorState, Loading, PageHeader, ProgressBar, StatCard, StatusBadge } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useApiQuery } from '@/hooks/useApiQuery';
import { fmtDate, pct } from '@/utils/format';
import { Stats } from '@/types';

function StatusCards({ s }: { s: Stats }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label={t('status.PRESENT')} value={s.present} tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
      <StatCard label={t('status.ABSENT')} value={s.absent} tone="red" icon={<UserX className="h-5 w-5" />} />
      <StatCard label={t('status.LATE')} value={s.late} tone="amber" icon={<Clock className="h-5 w-5" />} />
      <StatCard label={t('status.EXCUSED')} value={s.excused} tone="sky" icon={<ShieldCheck className="h-5 w-5" />} />
    </div>
  );
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="card p-5"><h2 className="mb-3 font-semibold">{title}</h2>{children}</div>;

export function AdminDashboard() {
  const { t } = useTranslation(); const { user } = useAuth(); const q = useApiQuery<any>('/admin/dashboard');
  if (q.isLoading) return <Loading />; if (q.errorMessage) return <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} />;
  const d = q.data!;
  return (
    <>
      <PageHeader title={t('dashboard.welcome', { name: user!.fullName })} subtitle={fmtDate(d.date)} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.totalStudents')} value={d.totals.students} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard label={t('dashboard.totalMonitors')} value={d.totals.monitors} icon={<UserCog className="h-5 w-5" />} tone="sky" />
        <StatCard label={t('dashboard.totalClasses')} value={d.totals.classes} icon={<School className="h-5 w-5" />} tone="slate" />
        <StatCard label={t('dashboard.overallRate')} value={pct(d.overall.percentage)} icon={<CalendarCheck className="h-5 w-5" />} tone="green" />
      </div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('dashboard.todayAttendance')} · {pct(d.today.percentage)}</h2>
      <StatusCards s={d.today} />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><Section title={t('dashboard.trend14')}><StackedTrend data={d.trend} xKey="period" /></Section></div>
        <Section title={t('dashboard.overallBreakdown')}><StatusPie counts={d.overall} /></Section>
      </div>
      <div className="mt-6"><Section title={t('dashboard.byClass')}><HBars data={d.classes} nameKey="name" valueKey="percentage" unit="%" /></Section></div>
    </>
  );
}

export function MonitorDashboard() {
  const { t } = useTranslation(); const { user } = useAuth(); const q = useApiQuery<any>('/monitor/dashboard');
  if (q.isLoading) return <Loading />; if (q.errorMessage) return <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} />;
  const d = q.data!;
  return (
    <>
      <PageHeader title={t('dashboard.welcome', { name: user!.fullName })} subtitle={`${d.class.name} · ${fmtDate(d.date)}`} actions={<Link to="/monitor/take-attendance" className="btn-primary">{t('nav.takeAttendance')}</Link>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.studentsInClass')} value={d.studentCount} icon={<Users className="h-5 w-5" />} />
        <StatCard label={t('dashboard.todayRate')} value={pct(d.today.percentage)} icon={<CalendarCheck className="h-5 w-5" />} tone="green" />
        <StatCard label={t('dashboard.overallRate')} value={pct(d.overall.percentage)} icon={<CalendarCheck className="h-5 w-5" />} tone="sky" />
        <Link to="/monitor/corrections"><StatCard label={t('dashboard.pendingCorrections')} value={d.pendingCorrections} icon={<FileClock className="h-5 w-5" />} tone="amber" /></Link>
      </div>
      <StatusCards s={d.today} />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title={t('dashboard.overallBreakdown')}><StatusPie counts={d.overall} /></Section>
        <div className="lg:col-span-2"><Section title={t('dashboard.recentActivity')}>
          {!d.recent.length ? <p className="py-8 text-center text-sm text-slate-400">{t('common.noData')}</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-navy-700">{d.recent.map((s: any) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div><p className="text-sm font-medium">{fmtDate(s.date)} · {t('attendance.sessionNo', { n: s.sessionNo })}</p>
                  <p className="text-xs text-slate-500">{t('status.PRESENT')} {s.counts.present} · {t('status.LATE')} {s.counts.late} · {t('status.ABSENT')} {s.counts.absent} · {t('status.EXCUSED')} {s.counts.excused}</p></div>
                {s.status === 'OPEN' ? <Link to={`/monitor/take-attendance?session=${s.id}`} className="btn-secondary !py-1">{t('attendance.continue')}</Link> : <StatusBadge value={s.status} kind="session" />}
              </li>))}</ul>)}
        </Section></div>
      </div>
    </>
  );
}

export function StudentDashboard() {
  const { t } = useTranslation(); const { user } = useAuth();
  const st = useApiQuery<any>('/student/me/statistics'); const recent = useApiQuery<any>('/student/me/attendance', { pageSize: 6 }); const settings = useApiQuery<any>('/settings');
  if (st.isLoading || recent.isLoading) return <Loading />; if (st.errorMessage) return <ErrorState message={st.errorMessage} onRetry={() => st.refetch()} />;
  const s: Stats = st.data!.statistics; const min = settings.data?.settings.minAttendancePercent ?? 80;
  return (
    <>
      <PageHeader title={t('dashboard.welcome', { name: user!.fullName })} subtitle={user!.studentCode ?? ''} />
      {s.total > 0 && s.percentage < min && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm">{t('dashboard.lowAttendance', { min })}</p></div>)}
      <div className="card mb-6 p-5"><div className="mb-2 flex items-end justify-between"><div><p className="text-sm text-slate-500">{t('dashboard.attendancePercentage')}</p><p className="text-4xl font-bold tabular-nums">{pct(s.percentage)}</p></div><p className="text-sm text-slate-500">{t('dashboard.totalSessions')}: <b>{s.total}</b></p></div><ProgressBar value={s.percentage} /></div>
      <StatusCards s={s} />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title={t('dashboard.overallBreakdown')}><StatusPie counts={s} /></Section>
        <div className="lg:col-span-2"><Section title={t('dashboard.recentHistory')}>
          {!recent.data?.items.length ? <p className="py-8 text-center text-sm text-slate-400">{t('common.noData')}</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-navy-700">{recent.data.items.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{fmtDate(r.date)} · {t('attendance.sessionNo', { n: r.sessionNo })}</p><p className="text-xs text-slate-500">{r.className}{r.remarks ? ` · ${r.remarks}` : ''}</p></div><StatusBadge value={r.status} /></li>))}</ul>)}
          <Link to="/student/history" className="mt-3 inline-block text-sm text-brand-600 hover:underline">{t('dashboard.viewAll')}</Link>
        </Section></div>
      </div>
    </>
  );
}
