import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCheck, Eye, FileClock, Pencil, Plus, Save, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ConfirmDialog, DataTable, EmptyState, ErrorState, Field, Loading, Modal, PageHeader, Pagination, Spinner, StatCard, StatusBadge, Toolbar } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAction, useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/services/api';
import { ClassRow, Counts, Paged, SessionRow, Status, STATUSES } from '@/types';
import { fmtDate, today } from '@/utils/format';
import clsx from 'clsx';

interface Row { studentId: string; studentCode: string; fullName: string; record: { id: string; status: Status; checkInTime: string | null; remarks: string | null } | null }
type Draft = Record<string, { status: Status | null; checkInTime: string; remarks: string }>;
const tone: Record<Status, string> = { PRESENT: 'bg-green-600 text-white', LATE: 'bg-amber-500 text-white', ABSENT: 'bg-red-600 text-white', EXCUSED: 'bg-sky-600 text-white' };

const countDraft = (d: Draft): Counts => { const c = { present: 0, absent: 0, late: 0, excused: 0 }; Object.values(d).forEach((x) => x.status && c[x.status.toLowerCase() as keyof Counts]++); return c; };

export function TakeAttendance() {
  const { t } = useTranslation(); const toast = useToast(); const nav = useNavigate(); const { run, busy } = useAction(); const [sp, setSp] = useSearchParams();
  const sessionId = sp.get('session');
  const [form, setForm] = useState({ date: today(), sessionNo: '1', subject: '', startTime: '08:00' });
  const open = useApiQuery<Paged<SessionRow>>('/attendance/sessions', { status: 'OPEN', pageSize: 10 });
  const q = useApiQuery<{ session: SessionRow; students: Row[] }>(`/attendance/sessions/${sessionId}`, undefined, { enabled: !!sessionId });
  const [draft, setDraft] = useState<Draft>({}); const [filter, setFilter] = useState(''); const [confirm, setConfirm] = useState(false); const [dirty, setDirty] = useState(false);
  useEffect(() => { // hydrate local state from the server whenever a (re)loaded session arrives
    if (!q.data) return;
    setDraft(Object.fromEntries(q.data.students.map((s) => [s.studentId, { status: s.record?.status ?? null, checkInTime: s.record?.checkInTime ?? '', remarks: s.record?.remarks ?? '' }]))); setDirty(false);
  }, [q.data]);
  const locked = q.data?.session.status === 'SUBMITTED'; const counts = useMemo(() => countDraft(draft), [draft]);
  const set = (id: string, p: Partial<Draft[string]>) => { setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } })); setDirty(true); };
  const payload = () => Object.entries(draft).filter(([, v]) => v.status).map(([studentId, v]) => ({ studentId, status: v.status, checkInTime: v.checkInTime || null, remarks: v.remarks || null }));
  const save = async (quiet = false) => { if (!payload().length) return true; const r = await run(() => api(`/attendance/sessions/${sessionId}/records`, { body: { records: payload() } }), quiet ? undefined : 'attendance.draftSaved'); return !!r; };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const r = await api('/attendance/sessions', { body: { date: form.date, sessionNo: +form.sessionNo, subject: form.subject || null, startTime: form.startTime || null } }); setSp({ session: r.session.id }); }
    catch (err: any) { if (err.code === 'DUPLICATE_SESSION' && err.details?.sessionId) { toast(t('errors.DUPLICATE_SESSION'), 'info'); setSp({ session: err.details.sessionId }); } else toast(t(`errors.${err.code}`, { defaultValue: t('errors.UNKNOWN') }), 'error'); }
  };

  if (!sessionId) return (
    <>
      <PageHeader title={t('nav.takeAttendance')} subtitle={t('attendance.startSubtitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={start} className="card space-y-4 p-5"><h2 className="font-semibold">{t('attendance.newSession')}</h2>
          <div className="grid gap-4 sm:grid-cols-2"><Field label={t('common.date')}><input required type="date" max={today()} className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label={t('attendance.sessionLabel')}><select className="input" value={form.sessionNo} onChange={(e) => setForm({ ...form, sessionNo: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{t('attendance.sessionNo', { n })}</option>)}</select></Field>
            <Field label={t('common.subject')}><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label={t('attendance.startTime')} hint={t('attendance.startTimeHint')}><input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field></div>
          <button className="btn-primary"><Plus className="h-4 w-4" />{t('attendance.start')}</button></form>
        <div className="card p-5"><h2 className="mb-3 font-semibold">{t('attendance.openSessions')}</h2>
          {open.isLoading ? <Loading /> : !open.data?.items.length ? <EmptyState text={t('attendance.noOpen')} /> : <ul className="divide-y divide-slate-100 dark:divide-navy-700">{open.data.items.map((s) => <li key={s.id} className="flex items-center justify-between py-3 text-sm"><span>{fmtDate(s.date)} · {t('attendance.sessionNo', { n: s.sessionNo })}</span><button className="btn-secondary !py-1" onClick={() => setSp({ session: s.id })}>{t('attendance.continue')}</button></li>)}</ul>}</div>
      </div>
    </>
  );
  if (q.isLoading) return <Loading />; if (q.errorMessage) return <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} />;
  const { session, students } = q.data!; const shown = students.filter((s) => (s.fullName + s.studentCode).toLowerCase().includes(filter.toLowerCase()));
  const unmarked = students.length - Object.values(draft).filter((d) => d.status).length;
  return (
    <>
      <PageHeader title={`${session.className} · ${fmtDate(session.date)}`} subtitle={`${t('attendance.sessionNo', { n: session.sessionNo })}${session.subject ? ` · ${session.subject}` : ''}${session.startTime ? ` · ${session.startTime}` : ''}`}
        actions={<><StatusBadge kind="session" value={session.status} /><button className="btn-secondary" onClick={() => setSp({})}>{t('common.back')}</button></>} />
      {locked && <div className="mb-4 rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200">{t('attendance.lockedNotice')} <Link className="font-medium underline" to="/monitor/history">{t('attendance.requestCorrectionLink')}</Link></div>}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label={t('status.PRESENT')} value={counts.present} tone="green" /><StatCard label={t('status.LATE')} value={counts.late} tone="amber" /><StatCard label={t('status.ABSENT')} value={counts.absent} tone="red" /><StatCard label={t('status.EXCUSED')} value={counts.excused} tone="sky" />
        <StatCard label={t('attendance.unmarked')} value={unmarked} tone="slate" /></div>
      <Toolbar><input className="input max-w-xs" placeholder={t('common.search')} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {!locked && <button className="btn-secondary" onClick={() => { setDraft((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.status ? v : { ...v, status: 'PRESENT' as Status }]))); setDirty(true); }}><CheckCheck className="h-4 w-4" />{t('attendance.markRestPresent')}</button>}</Toolbar>
      <div className="card divide-y divide-slate-100 dark:divide-navy-700">
        {shown.map((s) => { const d = draft[s.studentId]; if (!d) return null; return (
          <div key={s.studentId} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="min-w-0 lg:w-64"><p className="truncate font-medium">{s.fullName}</p><p className="font-mono text-xs text-slate-400">{s.studentCode}</p></div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={s.fullName}>{STATUSES.map((st) => (
              <button key={st} disabled={locked} aria-pressed={d.status === st} onClick={() => set(s.studentId, { status: st })} className={clsx('rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed', d.status === st ? `${tone[st]} border-transparent` : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-700')}>{t(`status.${st}`)}</button>))}</div>
            <div className="flex flex-1 gap-2"><input type="time" disabled={locked} className="input !w-32" aria-label={t('attendance.checkIn')} value={d.checkInTime} onChange={(e) => set(s.studentId, { checkInTime: e.target.value })} />
              <input disabled={locked} className="input" placeholder={t('common.remarks')} maxLength={300} value={d.remarks} onChange={(e) => set(s.studentId, { remarks: e.target.value })} /></div>
          </div>); })}
        {!shown.length && <EmptyState />}
      </div>
      {!locked && <div className="sticky bottom-3 mt-4 flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-navy-700 dark:bg-navy-800/95">
        <span className="mr-auto self-center text-sm text-slate-500">{dirty ? t('attendance.unsaved') : ''}</span>
        <button className="btn-secondary" disabled={busy} onClick={() => save()}>{busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}{t('attendance.saveDraft')}</button>
        <button className="btn-primary" disabled={busy} onClick={() => setConfirm(true)}><Send className="h-4 w-4" />{t('attendance.submit')}</button></div>}
      <ConfirmDialog open={confirm} busy={busy} onClose={() => setConfirm(false)} title={t('attendance.submit')} message={t('attendance.submitConfirm', { n: unmarked })}
        onConfirm={async () => { if (await save(true)) { const r = await run(() => api(`/attendance/sessions/${sessionId}/submit`, { method: 'POST' }), 'attendance.submitted'); if (r) { setConfirm(false); nav('/monitor/history'); } } }} />
    </>
  );
}

// ---------------- history / overview + session detail ----------------
function EditRecord({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const { t } = useTranslation(); const { run, busy } = useAction();
  const schema = z.object({ status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']), checkInTime: z.string().optional(), remarks: z.string().optional(), reason: z.string().min(3, t('validation.required')) });
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), values: { status: row?.record?.status ?? 'PRESENT', checkInTime: row?.record?.checkInTime ?? '', remarks: row?.record?.remarks ?? '', reason: '' } });
  const save = handleSubmit(async (v) => { if (await run(() => api(`/attendance/records/${row!.record!.id}`, { method: 'PUT', body: { ...v, checkInTime: v.checkInTime || null, remarks: v.remarks || null } }), 'toast.saved')) onClose(); });
  return (
    <Modal open={!!row} onClose={onClose} title={`${t('attendance.editRecord')} – ${row?.fullName ?? ''}`} footer={<><button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy} onClick={save}>{t('common.save')}</button></>}>
      <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{t('attendance.auditNotice')}</p>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
        <Field label={t('common.status')}><select className="input" {...register('status')}>{STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></Field>
        <Field label={t('attendance.checkIn')}><input type="time" className="input" {...register('checkInTime')} /></Field>
        <div className="sm:col-span-2"><Field label={t('common.remarks')}><input className="input" {...register('remarks')} /></Field></div>
        <div className="sm:col-span-2"><Field label={t('attendance.reason')} error={errors.reason?.message}><input className="input" {...register('reason')} /></Field></div>
      </form>
    </Modal>
  );
}

function CorrectionRequest({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const { t } = useTranslation(); const { run, busy } = useAction(); const [status, setStatus] = useState<Status>('PRESENT'); const [reason, setReason] = useState('');
  const send = async () => { if (await run(() => api('/attendance/corrections', { body: { recordId: row!.record!.id, requestedStatus: status, reason } }), 'corrections.sent')) { setReason(''); onClose(); } };
  return (
    <Modal open={!!row} onClose={onClose} title={`${t('corrections.request')} – ${row?.fullName ?? ''}`} footer={<><button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy || reason.length < 5} onClick={send}>{t('common.submit')}</button></>}>
      <div className="space-y-4"><p className="text-sm text-slate-500">{t('corrections.current')}: <StatusBadge value={row?.record?.status ?? 'PRESENT'} /></p>
        <Field label={t('corrections.requestedStatus')}><select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>{STATUSES.filter((s) => s !== row?.record?.status).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></Field>
        <Field label={t('attendance.reason')} hint={t('corrections.reasonHint')}><textarea rows={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
    </Modal>
  );
}

function SessionDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation(); const { user } = useAuth(); const q = useApiQuery<{ session: SessionRow; students: Row[] }>(`/attendance/sessions/${id}`, undefined, { enabled: !!id });
  const [edit, setEdit] = useState<Row | null>(null); const [req, setReq] = useState<Row | null>(null); const s = q.data?.session; const canReq = user!.role === 'MONITOR' && user!.permissions?.canRequestCorrections;
  return (
    <>
      <Modal open={!!id} onClose={onClose} wide title={s ? `${s.className} · ${fmtDate(s.date)} · ${t('attendance.sessionNo', { n: s.sessionNo })}` : t('common.loading')}>
        {!q.data ? <Loading /> : (<>
          <div className="mb-3 flex items-center gap-3"><StatusBadge kind="session" value={s!.status} />{s!.status === 'OPEN' && user!.role === 'MONITOR' && <Link className="btn-secondary !py-1" to={`/monitor/take-attendance?session=${s!.id}`}>{t('attendance.continue')}</Link>}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[480px]"><thead><tr><th className="th">{t('students.code')}</th><th className="th">{t('common.name')}</th><th className="th">{t('common.status')}</th><th className="th">{t('attendance.checkIn')}</th><th className="th">{t('common.remarks')}</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-700">{q.data.students.map((r) => (
              <tr key={r.studentId}><td className="td font-mono text-xs">{r.studentCode}</td><td className="td">{r.fullName}</td><td className="td">{r.record ? <StatusBadge value={r.record.status} /> : <span className="text-xs text-slate-400">{t('attendance.unmarked')}</span>}</td><td className="td">{r.record?.checkInTime ?? '—'}</td><td className="td text-xs text-slate-500">{r.record?.remarks ?? ''}</td>
                <td className="td text-right">{s!.status === 'SUBMITTED' && r.record && (user!.role === 'ADMIN' ? <button className="btn-ghost !p-1.5" aria-label={t('common.edit')} onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></button> : canReq && <button className="btn-ghost !p-1.5" aria-label={t('corrections.request')} onClick={() => setReq(r)}><FileClock className="h-4 w-4" /></button>)}</td></tr>))}</tbody></table></div></>)}
      </Modal>
      <EditRecord row={edit} onClose={() => setEdit(null)} /><CorrectionRequest row={req} onClose={() => setReq(null)} />
    </>
  );
}

export function AttendanceOverview() {
  const { t } = useTranslation(); const { user } = useAuth(); const admin = user!.role === 'ADMIN'; const [page, setPage] = useState(1); const [view, setView] = useState<string | null>(null);
  const [f, setF] = useState({ classId: '', from: '', to: '', status: '' });
  const classes = useApiQuery<Paged<ClassRow>>('/classes', { pageSize: 100 }, { enabled: admin }); const q = useApiQuery<Paged<SessionRow>>('/attendance/sessions', { page, pageSize: 15, ...f });
  const upd = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setPage(1); };
  return (
    <>
      <PageHeader title={admin ? t('nav.attendanceOverview') : t('nav.history')} subtitle={t('attendance.historySubtitle')} />
      <Toolbar>
        {admin && <select className="input max-w-[220px]" value={f.classId} onChange={(e) => upd({ classId: e.target.value })} aria-label={t('common.class')}><option value="">{t('common.allClasses')}</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <input type="date" className="input max-w-[160px]" value={f.from} onChange={(e) => upd({ from: e.target.value })} aria-label={t('common.from')} /><input type="date" className="input max-w-[160px]" value={f.to} onChange={(e) => upd({ to: e.target.value })} aria-label={t('common.to')} />
        <select className="input max-w-[160px]" value={f.status} onChange={(e) => upd({ status: e.target.value })} aria-label={t('common.status')}><option value="">{t('common.all')}</option><option value="OPEN">{t('sessionStatus.OPEN')}</option><option value="SUBMITTED">{t('sessionStatus.SUBMITTED')}</option></select>
        <button className="btn-ghost" onClick={() => { setF({ classId: '', from: '', to: '', status: '' }); setPage(1); }}>{t('common.reset')}</button></Toolbar>
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[{ key: 'd', header: t('common.date'), render: (r) => fmtDate(r.date) }, { key: 's', header: t('common.session'), render: (r) => r.sessionNo }, { key: 'c', header: t('common.class'), render: (r) => r.className },
          { key: 'st', header: t('common.status'), render: (r) => <StatusBadge kind="session" value={r.status} /> },
          { key: 'p', header: t('status.PRESENT'), render: (r) => r.counts?.present ?? 0 }, { key: 'l', header: t('status.LATE'), render: (r) => r.counts?.late ?? 0 },
          { key: 'a', header: t('status.ABSENT'), render: (r) => r.counts?.absent ?? 0 }, { key: 'e', header: t('status.EXCUSED'), render: (r) => r.counts?.excused ?? 0 },
          { key: 'x', header: '', render: (r) => <button className="btn-ghost !p-1.5" aria-label={t('common.view')} onClick={() => setView(r.id)}><Eye className="h-4 w-4" /></button> }]}
        footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      <SessionDetail id={view} onClose={() => setView(null)} />
    </>
  );
}
