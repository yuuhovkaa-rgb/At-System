import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ConfirmDialog, DataTable, ErrorState, Field, Loading, Modal, PageHeader, Pagination, ProgressBar, Spinner, StatusBadge, Toolbar } from '@/components/ui';
import { StatusPie } from '@/components/charts';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAction, useApiQuery } from '@/hooks/useApiQuery';
import { useBase } from '@/hooks/useBase';
import { useDebounce } from '@/hooks/useDebounce';
import { api, download } from '@/services/api';
import { ClassRow, Paged, StudentRow } from '@/types';
import { downloadCsv, fmtDate, pct } from '@/utils/format';

function StudentForm({ open, onClose, student }: { open: boolean; onClose: () => void; student?: StudentRow | null }) {
  const { t } = useTranslation(); const { run, busy } = useAction(); const toast = useToast();
  const classes = useApiQuery<Paged<ClassRow>>('/classes', { pageSize: 100 }, { enabled: open });
  const schema = z.object({ studentCode: z.string().min(2, t('validation.required')), fullName: z.string().min(2, t('validation.required')), email: z.string().email(t('validation.email')),
    gender: z.string().optional(), phone: z.string().optional(), classId: z.string().optional(), isActive: z.boolean().optional() });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), values: student ? { studentCode: student.studentCode, fullName: student.fullName, email: student.email, gender: student.gender ?? '', phone: student.phone ?? '', isActive: student.isActive } : { studentCode: '', fullName: '', email: '', gender: '', phone: '', classId: '' } });
  const submit = handleSubmit(async (v) => {
    const body = { ...v, gender: v.gender || null, phone: v.phone || null, classId: v.classId || null };
    const r: any = await run(() => student ? api(`/students/${student.id}`, { method: 'PUT', body }) : api('/students', { body }), 'toast.saved');
    if (r) { if (r.temporaryPassword) toast(`${t('students.tempPassword')}: ${r.temporaryPassword}`, 'info'); reset(); onClose(); }
  });
  return (
    <Modal open={open} onClose={onClose} title={student ? t('students.edit') : t('students.add')} footer={<><button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}{t('common.save')}</button></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
        <Field label={t('students.code')} error={errors.studentCode?.message}><input className="input" {...register('studentCode')} /></Field>
        <Field label={t('common.name')} error={errors.fullName?.message}><input className="input" {...register('fullName')} /></Field>
        <Field label={t('common.email')} error={errors.email?.message}><input className="input" type="email" {...register('email')} /></Field>
        <Field label={t('common.phone')}><input className="input" {...register('phone')} /></Field>
        <Field label={t('common.gender')}><select className="input" {...register('gender')}><option value="">—</option><option value="M">{t('common.male')}</option><option value="F">{t('common.female')}</option><option value="O">{t('common.other')}</option></select></Field>
        {student ? <Field label={t('common.status')}><select className="input" {...register('isActive', { setValueAs: (v) => v === true || v === 'true' })}><option value="true">{t('common.active')}</option><option value="false">{t('common.inactive')}</option></select></Field>
          : <Field label={t('common.class')} hint={t('students.tempPasswordHint')}><select className="input" {...register('classId')}><option value="">—</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      </form>
    </Modal>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(); const { run, busy } = useAction(); const [file, setFile] = useState<File | null>(null); const [res, setRes] = useState<any>(null);
  const go = async () => { const f = new FormData(); f.append('file', file!); const r = await run(() => api('/students/import', { form: f }), 'toast.saved'); if (r) setRes(r); };
  const close = () => { setFile(null); setRes(null); onClose(); };
  return (
    <Modal open={open} onClose={close} title={t('students.import')} footer={<><button className="btn-secondary" onClick={close}>{t('common.close')}</button>{!res && <button className="btn-primary" disabled={!file || busy} onClick={go}>{busy && <Spinner className="h-4 w-4 text-white" />}{t('students.import')}</button>}</>}>
      {!res ? (<div className="space-y-3 text-sm"><p>{t('students.importHelp')}</p><code className="block rounded bg-slate-100 p-2 text-xs dark:bg-navy-900">studentCode, fullName, email, gender, phone, classCode</code>
        <input type="file" accept=".csv,.xlsx" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>) : (
        <div className="space-y-3 text-sm"><p className="font-medium">{t('students.importResult', { created: res.created, failed: res.failed })}</p>
          {res.created > 0 && <><p className="text-slate-500">{t('students.credentialsHint')}</p><button className="btn-secondary" onClick={() => downloadCsv('student-credentials.csv', res.credentials)}><Download className="h-4 w-4" />{t('students.downloadCredentials')}</button></>}
          {res.errors.length > 0 && <ul className="max-h-40 space-y-1 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">{res.errors.map((e: any, i: number) => <li key={i}>{t('students.row', { n: e.row })}: {e.error}</li>)}</ul>}</div>)}
    </Modal>
  );
}

export function StudentsPage() {
  const { t } = useTranslation(); const { user } = useAuth(); const base = useBase(); const admin = user!.role === 'ADMIN';
  const [sp, setSp] = useSearchParams(); const [page, setPage] = useState(1); const [classId, setClassId] = useState(''); const [form, setForm] = useState<{ open: boolean; s?: StudentRow | null }>({ open: false });
  const [del, setDel] = useState<StudentRow | null>(null); const [imp, setImp] = useState(false); const { run, busy } = useAction();
  const search = sp.get('q') ?? ''; const dq = useDebounce(search);
  const q = useApiQuery<Paged<StudentRow>>('/students', { page, pageSize: 15, q: dq, classId });
  const classes = useApiQuery<Paged<ClassRow>>('/classes', { pageSize: 100 }, { enabled: admin });
  return (
    <>
      <PageHeader title={admin ? t('nav.students') : t('nav.studentList')} subtitle={t('students.subtitle')} actions={admin && <>
        <button className="btn-secondary" onClick={() => setImp(true)}><Upload className="h-4 w-4" />{t('students.import')}</button>
        <button className="btn-secondary" onClick={() => download('/students/export', { format: 'xlsx', q: dq, classId }, 'students.xlsx')}><Download className="h-4 w-4" />Excel</button>
        <button className="btn-secondary" onClick={() => download('/students/export', { format: 'csv', q: dq, classId }, 'students.csv')}><Download className="h-4 w-4" />CSV</button>
        <button className="btn-primary" onClick={() => setForm({ open: true, s: null })}><Plus className="h-4 w-4" />{t('students.add')}</button></>} />
      <Toolbar>
        <input className="input max-w-xs" placeholder={t('common.search')} value={search} onChange={(e) => { setSp(e.target.value ? { q: e.target.value } : {}); setPage(1); }} aria-label={t('common.search')} />
        {admin && <select className="input max-w-[220px]" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} aria-label={t('common.class')}><option value="">{t('common.allClasses')}</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      </Toolbar>
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: t('students.code'), render: (r) => <span className="font-mono text-xs">{r.studentCode}</span> },
          { key: 'name', header: t('common.name'), render: (r) => <Link className="font-medium hover:text-brand-600" to={`${base}/students/${r.id}`}>{r.fullName}</Link> },
          { key: 'email', header: t('common.email'), render: (r) => r.email },
          { key: 'class', header: t('common.class'), render: (r) => r.classes.map((c) => c.code).join(', ') || '—' },
          { key: 'status', header: t('common.status'), render: (r) => <StatusBadge kind="active" value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
          { key: 'actions', header: t('common.actions'), render: (r) => <div className="flex gap-1">
            <Link className="btn-ghost !p-1.5" to={`${base}/students/${r.id}`} aria-label={t('common.view')}><Eye className="h-4 w-4" /></Link>
            {admin && <><button className="btn-ghost !p-1.5" aria-label={t('common.edit')} onClick={() => setForm({ open: true, s: r })}><Pencil className="h-4 w-4" /></button>
              <button className="btn-ghost !p-1.5 text-red-600" aria-label={t('students.deactivate')} onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></button></>}</div> },
        ]}
        footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      {admin && <StudentForm open={form.open} student={form.s} onClose={() => setForm({ open: false })} />}
      {admin && <ImportModal open={imp} onClose={() => setImp(false)} />}
      <ConfirmDialog open={!!del} danger busy={busy} onClose={() => setDel(null)} title={t('students.deactivate')} message={t('students.deactivateConfirm', { name: del?.fullName })} onConfirm={async () => { await run(() => api(`/students/${del!.id}`, { method: 'DELETE' }), 'toast.deleted'); setDel(null); }} />
    </>
  );
}

export function StudentDetails() {
  const { t } = useTranslation(); const { id } = useParams(); const base = useBase(); const q = useApiQuery<any>(`/students/${id}`);
  if (q.isLoading) return <Loading />; if (q.errorMessage) return <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} />;
  const { student: s, statistics: st, recent } = q.data!;
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-navy-700"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v || '—'}</dd></div>;
  return (
    <>
      <PageHeader title={s.fullName} subtitle={s.studentCode} actions={<Link to={`${base}/students`} className="btn-secondary">{t('common.back')}</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5"><h2 className="mb-2 font-semibold">{t('profile.info')}</h2><dl>
          {row(t('common.email'), s.email)}{row(t('common.phone'), s.phone)}{row(t('common.gender'), s.gender && t(`common.${{ M: 'male', F: 'female', O: 'other' }[s.gender as 'M']}`))}{row(t('common.address'), s.address)}{row(t('common.class'), s.classes.map((c: any) => c.name).join(', '))}{row(t('common.status'), <StatusBadge kind="active" value={s.isActive ? 'ACTIVE' : 'INACTIVE'} />)}</dl></div>
        <div className="card p-5"><h2 className="mb-1 font-semibold">{t('dashboard.attendancePercentage')}</h2><p className="mb-2 text-3xl font-bold">{pct(st.percentage)}</p><ProgressBar value={st.percentage} /><StatusPie counts={st} /></div>
        <div className="card p-5"><h2 className="mb-2 font-semibold">{t('dashboard.recentHistory')}</h2>
          {!recent.length ? <p className="py-6 text-center text-sm text-slate-400">{t('common.noData')}</p> : <ul className="divide-y divide-slate-100 dark:divide-navy-700">{recent.map((r: any) => <li key={r.id} className="flex items-center justify-between py-2 text-sm"><span>{fmtDate(r.date)} · {t('attendance.sessionNo', { n: r.sessionNo })}</span><StatusBadge value={r.status} /></li>)}</ul>}</div>
      </div>
    </>
  );
}
