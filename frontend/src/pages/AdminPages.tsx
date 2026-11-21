import { KeyRound, Plus, Power } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, DataTable, ErrorState, Field, Loading, Modal, PageHeader, Pagination, Spinner, StatusBadge, Toolbar } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAction, useApiQuery } from '@/hooks/useApiQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/services/api';
import { AcademicYear, Paged, Settings } from '@/types';
import { fmtDate, fmtDateTime } from '@/utils/format';

interface U { id: string; email: string; fullName: string; role: string; isActive: boolean; lastLoginAt: string | null }

export function UsersPage() {
  const { t } = useTranslation(); const { user } = useAuth(); const toast = useToast(); const { run, busy } = useAction();
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [role, setRole] = useState(''); const dq = useDebounce(search); const [reset, setReset] = useState<U | null>(null); const [add, setAdd] = useState(false); const [toggle, setToggle] = useState<U | null>(null);
  const q = useApiQuery<Paged<U>>('/admin/users', { page, pageSize: 15, q: dq, role });
  const { register, handleSubmit, reset: rf } = useForm<{ fullName: string; email: string }>();
  return (
    <>
      <PageHeader title={t('nav.users')} subtitle={t('users.subtitle')} actions={<button className="btn-primary" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />{t('users.addAdmin')}</button>} />
      <Toolbar><input className="input max-w-xs" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input max-w-[180px]" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label={t('common.role')}><option value="">{t('common.all')}</option>{['ADMIN', 'MONITOR', 'STUDENT'].map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</select></Toolbar>
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[{ key: 'n', header: t('common.name'), render: (r) => <span className="font-medium">{r.fullName}</span> }, { key: 'e', header: t('common.email'), render: (r) => r.email }, { key: 'r', header: t('common.role'), render: (r) => t(`roles.${r.role}`) },
          { key: 's', header: t('common.status'), render: (r) => <StatusBadge kind="active" value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> }, { key: 'l', header: t('users.lastLogin'), render: (r) => fmtDateTime(r.lastLoginAt) },
          { key: 'a', header: t('common.actions'), render: (r) => <div className="flex gap-1"><button className="btn-ghost !p-1.5" aria-label={t('users.resetPassword')} onClick={() => setReset(r)}><KeyRound className="h-4 w-4" /></button>
            {r.id !== user!.id && <button className="btn-ghost !p-1.5" aria-label={r.isActive ? t('users.deactivate') : t('users.activate')} onClick={() => setToggle(r)}><Power className={`h-4 w-4 ${r.isActive ? 'text-red-600' : 'text-green-600'}`} /></button>}</div> }]}
        footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      <ConfirmDialog open={!!reset} busy={busy} onClose={() => setReset(null)} title={t('users.resetPassword')} message={t('users.resetConfirm', { name: reset?.fullName })} onConfirm={async () => { const r: any = await run(() => api(`/admin/users/${reset!.id}/reset-password`, { body: {} })); if (r?.temporaryPassword) toast(`${t('students.tempPassword')}: ${r.temporaryPassword}`, 'info'); setReset(null); }} />
      <ConfirmDialog open={!!toggle} danger={toggle?.isActive} busy={busy} onClose={() => setToggle(null)} title={toggle?.isActive ? t('users.deactivate') : t('users.activate')} message={t('users.toggleConfirm', { name: toggle?.fullName })} onConfirm={async () => { await run(() => api(`/admin/users/${toggle!.id}`, { method: 'PATCH', body: { isActive: !toggle!.isActive } }), 'toast.updated'); setToggle(null); }} />
      <Modal open={add} onClose={() => setAdd(false)} title={t('users.addAdmin')} footer={<><button className="btn-secondary" onClick={() => setAdd(false)}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy} onClick={handleSubmit(async (v) => { const r: any = await run(() => api('/admin/users', { body: v }), 'toast.created'); if (r) { if (r.temporaryPassword) toast(`${t('students.tempPassword')}: ${r.temporaryPassword}`, 'info'); rf(); setAdd(false); } })}>{busy && <Spinner className="h-4 w-4 text-white" />}{t('common.save')}</button></>}>
        <div className="space-y-4"><Field label={t('common.name')}><input className="input" {...register('fullName', { required: true })} /></Field><Field label={t('common.email')}><input type="email" className="input" {...register('email', { required: true })} /></Field></div></Modal>
    </>
  );
}

export function AuditLogsPage() {
  const { t } = useTranslation(); const [page, setPage] = useState(1); const [action, setAction] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [open, setOpen] = useState<any>(null); const da = useDebounce(action);
  const q = useApiQuery<Paged<any>>('/admin/audit-logs', { page, pageSize: 20, action: da, from, to });
  return (
    <>
      <PageHeader title={t('nav.auditLogs')} subtitle={t('audit.subtitle')} />
      <Toolbar><input className="input max-w-xs" placeholder={t('audit.actionFilter')} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} /><button className="btn-secondary" onClick={() => { setAction('LOGIN'); setPage(1); }}>{t('audit.loginActivity')}</button>
        <input type="date" className="input max-w-[160px]" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('common.from')} /><input type="date" className="input max-w-[160px]" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('common.to')} /></Toolbar>
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[{ key: 't', header: t('common.time'), render: (r) => fmtDateTime(r.createdAt) }, { key: 'u', header: t('common.user'), render: (r) => r.user ?? '—' }, { key: 'a', header: t('audit.action'), render: (r) => <span className="font-mono text-xs">{r.action}</span> }, { key: 'e', header: t('audit.entity'), render: (r) => r.entity },
          { key: 'ip', header: 'IP', render: (r) => <span className="text-xs text-slate-400">{r.ip ?? '—'}</span> }, { key: 'd', header: t('common.details'), render: (r) => (r.before || r.after) ? <button className="text-xs text-brand-600 hover:underline" onClick={() => setOpen(r)}>{t('common.view')}</button> : '—' }]}
        footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      <Modal open={!!open} onClose={() => setOpen(null)} wide title={open?.action ?? ''}><div className="grid gap-3 sm:grid-cols-2">{(['before', 'after'] as const).map((k) => <div key={k}><p className="mb-1 text-xs font-semibold uppercase text-slate-400">{t(`audit.${k}`)}</p><pre className="max-h-72 overflow-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-navy-900">{open?.[k] ? JSON.stringify(open[k], null, 2) : '—'}</pre></div>)}</div></Modal>
    </>
  );
}

export function SystemSettings() {
  const { t } = useTranslation(); const { run, busy } = useAction(); const q = useApiQuery<{ settings: Settings }>('/settings'); const years = useApiQuery<{ items: AcademicYear[] }>('/academic-years');
  const [yf, setYf] = useState({ name: '', startDate: '', endDate: '' }); const [sf, setSf] = useState({ academicYearId: '', name: '', startDate: '', endDate: '' }); const [s, setS] = useState<Settings | null>(null);
  if (q.isLoading) return <Loading />; if (q.errorMessage) return <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} />;
  const v = s ?? q.data!.settings; const upd = (p: Partial<Settings>) => setS({ ...v, ...p });
  return (
    <>
      <PageHeader title={t('nav.systemSettings')} subtitle={t('settings.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="card space-y-4 p-5" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/settings', { method: 'PUT', body: { schoolName: v.schoolName, timezone: v.timezone, excusedPolicy: v.excusedPolicy, lateCountsAsPresent: v.lateCountsAsPresent, lateAfterMinutes: v.lateAfterMinutes, minAttendancePercent: v.minAttendancePercent } }), 'toast.saved')) setS(null); }}>
          <h2 className="font-semibold">{t('settings.school')}</h2>
          <Field label={t('settings.schoolName')}><input className="input" value={v.schoolName} onChange={(e) => upd({ schoolName: e.target.value })} /></Field>
          <Field label={t('settings.timezone')} hint="e.g. Asia/Phnom_Penh"><input className="input" value={v.timezone} onChange={(e) => upd({ timezone: e.target.value })} /></Field>
          <h2 className="pt-2 font-semibold">{t('settings.rules')}</h2>
          <Field label={t('settings.excusedPolicy')} hint={t('settings.excusedHint')}><select className="input" value={v.excusedPolicy} onChange={(e) => upd({ excusedPolicy: e.target.value as Settings['excusedPolicy'] })}>{['EXCLUDE', 'COUNT_AS_PRESENT', 'COUNT_AS_ABSENT'].map((p) => <option key={p} value={p}>{t(`settings.policy.${p}`)}</option>)}</select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.lateCountsAsPresent} onChange={(e) => upd({ lateCountsAsPresent: e.target.checked })} />{t('settings.lateCounts')}</label>
          <div className="grid gap-4 sm:grid-cols-2"><Field label={t('settings.lateAfter')} hint={t('settings.lateAfterHint')}><input type="number" min={0} max={240} className="input" value={v.lateAfterMinutes} onChange={(e) => upd({ lateAfterMinutes: +e.target.value })} /></Field>
            <Field label={t('settings.minPercent')}><input type="number" min={0} max={100} className="input" value={v.minAttendancePercent} onChange={(e) => upd({ minAttendancePercent: +e.target.value })} /></Field></div>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}{t('common.save')}</button>
        </form>
        <div className="card space-y-4 p-5"><h2 className="font-semibold">{t('settings.academicYears')}</h2>
          <ul className="divide-y divide-slate-100 dark:divide-navy-700">{years.data?.items.map((y) => (
            <li key={y.id} className="py-2 text-sm"><div className="flex justify-between"><span className="font-medium">{y.name} {y.isCurrent && <span className="ml-1 rounded bg-green-100 px-1.5 text-[10px] font-semibold text-green-700">{t('settings.current')}</span>}</span><span className="text-slate-500">{fmtDate(y.startDate)} – {fmtDate(y.endDate)}</span></div>
              {y.semesters.map((m) => <p key={m.id} className="ml-4 text-xs text-slate-500">↳ {m.name}: {fmtDate(m.startDate)} – {fmtDate(m.endDate)}</p>)}</li>))}</ul>
          <form className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 dark:border-navy-700" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/academic-years', { body: yf }), 'toast.created')) setYf({ name: '', startDate: '', endDate: '' }); }}>
            <input required className="input col-span-2" placeholder={t('settings.yearName')} value={yf.name} onChange={(e) => setYf({ ...yf, name: e.target.value })} /><input required type="date" className="input" value={yf.startDate} onChange={(e) => setYf({ ...yf, startDate: e.target.value })} /><input required type="date" className="input" value={yf.endDate} onChange={(e) => setYf({ ...yf, endDate: e.target.value })} />
            <button className="btn-secondary col-span-2" disabled={busy}><Plus className="h-4 w-4" />{t('settings.addYear')}</button></form>
          <form className="grid grid-cols-2 gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/academic-years/semesters', { body: sf }), 'toast.created')) setSf({ academicYearId: '', name: '', startDate: '', endDate: '' }); }}>
            <select required className="input" value={sf.academicYearId} onChange={(e) => setSf({ ...sf, academicYearId: e.target.value })}><option value="">{t('settings.academicYear')}</option>{years.data?.items.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select><input required className="input" placeholder={t('settings.semesterName')} value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} />
            <input required type="date" className="input" value={sf.startDate} onChange={(e) => setSf({ ...sf, startDate: e.target.value })} /><input required type="date" className="input" value={sf.endDate} onChange={(e) => setSf({ ...sf, endDate: e.target.value })} />
            <button className="btn-secondary col-span-2" disabled={busy}><Plus className="h-4 w-4" />{t('settings.addSemester')}</button></form>
          <p className="text-xs text-slate-400">{t('settings.languagesNote')}</p></div>
      </div>
    </>
  );
}
