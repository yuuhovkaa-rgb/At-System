import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Pencil, Plus, Settings2, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ScheduleList } from '@/components/Schedule';
import { ConfirmDialog, DataTable, ErrorState, Field, Loading, Modal, PageHeader, Pagination, Spinner, StatusBadge, Toolbar } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAction, useApiQuery } from '@/hooks/useApiQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/services/api';
import { AcademicYear, ClassRow, Paged, StudentRow } from '@/types';

const Footer = ({ onClose, onSave, busy }: { onClose: () => void; onSave: () => void; busy: boolean }) => { const { t } = useTranslation(); return <><button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy} onClick={onSave}>{busy && <Spinner className="h-4 w-4 text-white" />}{t('common.save')}</button></>; };

function ClassForm({ open, onClose, cls }: { open: boolean; onClose: () => void; cls?: ClassRow | null }) {
  const { t } = useTranslation(); const { run, busy } = useAction(); const years = useApiQuery<{ items: AcademicYear[] }>('/academic-years', undefined, { enabled: open });
  const schema = z.object({ code: z.string().min(2, t('validation.required')), name: z.string().min(2, t('validation.required')), description: z.string().optional(), academicYearId: z.string().min(1, t('validation.required')), semesterId: z.string().optional() });
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), values: cls ? { code: cls.code, name: cls.name, description: cls.description ?? '', academicYearId: cls.academicYear?.id ?? '', semesterId: cls.semester?.id ?? '' } : { code: '', name: '', description: '', academicYearId: '', semesterId: '' } });
  const sems = years.data?.items.find((y) => y.id === watch('academicYearId'))?.semesters ?? [];
  const save = handleSubmit(async (v) => { const body = { ...v, description: v.description || null, semesterId: v.semesterId || null }; if (await run(() => cls ? api(`/classes/${cls.id}`, { method: 'PUT', body }) : api('/classes', { body }), 'toast.saved')) { reset(); onClose(); } });
  return (
    <Modal open={open} onClose={onClose} title={cls ? t('classes.edit') : t('classes.add')} footer={<Footer onClose={onClose} onSave={save} busy={busy} />}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={save} noValidate>
        <Field label={t('classes.code')} error={errors.code?.message}><input className="input" {...register('code')} /></Field>
        <Field label={t('common.name')} error={errors.name?.message}><input className="input" {...register('name')} /></Field>
        <Field label={t('settings.academicYear')} error={errors.academicYearId?.message}><select className="input" {...register('academicYearId')}><option value="">—</option>{years.data?.items.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
        <Field label={t('settings.semester')}><select className="input" {...register('semesterId')}><option value="">—</option>{sems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label={t('common.description')}><textarea rows={2} className="input" {...register('description')} /></Field></div>
      </form>
    </Modal>
  );
}

function ClassManage({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation(); const { run, busy } = useAction(); const q = useApiQuery<any>(`/classes/${id}`, undefined, { enabled: !!id });
  const all = useApiQuery<Paged<StudentRow>>('/students', { pageSize: 100, active: 'true' }, { enabled: !!id }); const [pick, setPick] = useState(''); const [slot, setSlot] = useState({ subject: '', dayOfWeek: '1', sessionNo: '1', startTime: '08:00', endTime: '09:30', room: '' });
  const c = q.data?.class; const inClass = new Set<string>(c?.students.map((s: any) => s.id) ?? []);
  return (
    <Modal open={!!id} onClose={onClose} wide title={c?.name ?? t('common.loading')}>
      {!c ? <Loading /> : (
        <div className="space-y-6">
          <section><h3 className="mb-2 font-semibold">{t('nav.students')} ({c.students.length})</h3>
            <div className="mb-3 flex gap-2"><select className="input" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">{t('classes.pickStudent')}</option>{all.data?.items.filter((s) => !inClass.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.studentCode} – {s.fullName}</option>)}</select>
              <button className="btn-primary" disabled={!pick || busy} onClick={async () => { await run(() => api(`/classes/${id}/students`, { body: { studentIds: [pick] } }), 'toast.saved'); setPick(''); }}>{t('common.add')}</button></div>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-navy-700 dark:border-navy-700">{c.students.map((s: any) => <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm"><span>{s.studentCode} · {s.fullName}</span><button className="text-red-600" aria-label={t('common.delete')} onClick={() => run(() => api(`/classes/${id}/students/${s.id}`, { method: 'DELETE' }), 'toast.deleted')}><UserMinus className="h-4 w-4" /></button></li>)}
              {!c.students.length && <li className="px-3 py-4 text-center text-sm text-slate-400">{t('common.noData')}</li>}</ul></section>
          <section><h3 className="mb-2 font-semibold">{t('nav.schedule')}</h3>
            <form className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-6" onSubmit={async (e) => { e.preventDefault(); await run(() => api(`/classes/${id}/schedule`, { body: { ...slot, dayOfWeek: +slot.dayOfWeek, sessionNo: +slot.sessionNo, room: slot.room || null } }), 'toast.saved'); }}>
              <input required className="input col-span-2" placeholder={t('schedule.subject')} value={slot.subject} onChange={(e) => setSlot({ ...slot, subject: e.target.value })} />
              <select className="input" value={slot.dayOfWeek} onChange={(e) => setSlot({ ...slot, dayOfWeek: e.target.value })}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{t(`days.${d}`)}</option>)}</select>
              <input className="input" type="time" value={slot.startTime} onChange={(e) => setSlot({ ...slot, startTime: e.target.value })} /><input className="input" type="time" value={slot.endTime} onChange={(e) => setSlot({ ...slot, endTime: e.target.value })} />
              <button className="btn-primary" disabled={busy}><Plus className="h-4 w-4" />{t('common.add')}</button></form>
            <ScheduleList items={c.schedule} onDelete={(s) => run(() => api(`/classes/${id}/schedule/${s.id}`, { method: 'DELETE' }), 'toast.deleted')} /></section>
        </div>)}
    </Modal>
  );
}

export function ClassesPage() {
  const { t } = useTranslation(); const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [archived, setArchived] = useState(false); const dq = useDebounce(search);
  const [form, setForm] = useState<{ open: boolean; c?: ClassRow | null }>({ open: false }); const [manage, setManage] = useState<string | null>(null); const [arch, setArch] = useState<ClassRow | null>(null); const { run, busy } = useAction();
  const q = useApiQuery<Paged<ClassRow>>('/classes', { page, pageSize: 15, q: dq, archived: String(archived) });
  return (
    <>
      <PageHeader title={t('nav.classes')} subtitle={t('classes.subtitle')} actions={<button className="btn-primary" onClick={() => setForm({ open: true, c: null })}><Plus className="h-4 w-4" />{t('classes.add')}</button>} />
      <Toolbar><input className="input max-w-xs" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={(e) => { setArchived(e.target.checked); setPage(1); }} />{t('classes.showArchived')}</label></Toolbar>
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: t('classes.code'), render: (r) => <span className="font-mono text-xs">{r.code}</span> }, { key: 'name', header: t('common.name'), render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'year', header: t('settings.academicYear'), render: (r) => r.academicYear?.name ?? '—' }, { key: 'students', header: t('nav.students'), render: (r) => r.studentCount },
          { key: 'monitor', header: t('roles.MONITOR'), render: (r) => r.monitors.map((m) => m.fullName).join(', ') || '—' },
          { key: 'actions', header: t('common.actions'), render: (r) => <div className="flex gap-1"><button className="btn-ghost !p-1.5" aria-label={t('classes.manage')} onClick={() => setManage(r.id)}><Settings2 className="h-4 w-4" /></button>
            <button className="btn-ghost !p-1.5" aria-label={t('common.edit')} onClick={() => setForm({ open: true, c: r })}><Pencil className="h-4 w-4" /></button>
            {!r.archived && <button className="btn-ghost !p-1.5 text-red-600" aria-label={t('classes.archive')} onClick={() => setArch(r)}><Archive className="h-4 w-4" /></button>}</div> }]}
        footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      <ClassForm open={form.open} cls={form.c} onClose={() => setForm({ open: false })} /><ClassManage id={manage} onClose={() => setManage(null)} />
      <ConfirmDialog open={!!arch} danger busy={busy} onClose={() => setArch(null)} title={t('classes.archive')} message={t('classes.archiveConfirm', { name: arch?.name })} onConfirm={async () => { await run(() => api(`/classes/${arch!.id}`, { method: 'DELETE' }), 'toast.deleted'); setArch(null); }} />
    </>
  );
}

// ---------------- monitors ----------------
interface MonRow { id: string; fullName: string; email: string; isActive: boolean; classId: string; className: string; canPublishAnnouncements: boolean; canExportReports: boolean; canRequestCorrections: boolean }
function MonitorForm({ open, onClose, m }: { open: boolean; onClose: () => void; m?: MonRow | null }) {
  const { t } = useTranslation(); const { run, busy } = useAction(); const toast = useToast(); const classes = useApiQuery<Paged<ClassRow>>('/classes', { pageSize: 100 }, { enabled: open });
  const schema = z.object({ fullName: z.string().min(2, t('validation.required')), email: z.string().email(t('validation.email')), classId: z.string().min(1, t('validation.required')), isActive: z.boolean(), canPublishAnnouncements: z.boolean(), canExportReports: z.boolean(), canRequestCorrections: z.boolean() });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), values: m ?? { fullName: '', email: '', classId: '', isActive: true, canPublishAnnouncements: true, canExportReports: true, canRequestCorrections: true } });
  const save = handleSubmit(async (v) => { const r: any = await run(() => m ? api(`/monitors/${m.id}`, { method: 'PUT', body: v }) : api('/monitors', { body: v }), 'toast.saved'); if (r) { if (r.temporaryPassword) toast(`${t('students.tempPassword')}: ${r.temporaryPassword}`, 'info'); reset(); onClose(); } });
  return (
    <Modal open={open} onClose={onClose} title={m ? t('monitors.edit') : t('monitors.add')} footer={<Footer onClose={onClose} onSave={save} busy={busy} />}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={save} noValidate>
        <Field label={t('common.name')} error={errors.fullName?.message}><input className="input" {...register('fullName')} /></Field>
        <Field label={t('common.email')} error={errors.email?.message}><input className="input" type="email" disabled={!!m} {...register('email')} /></Field>
        <div className="sm:col-span-2"><Field label={t('monitors.assignedClass')} error={errors.classId?.message}><select className="input" {...register('classId')}><option value="">—</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
        <fieldset className="space-y-2 sm:col-span-2"><legend className="mb-1 text-sm font-medium">{t('monitors.permissions')}</legend>
          {(['canPublishAnnouncements', 'canExportReports', 'canRequestCorrections'] as const).map((k) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" {...register(k)} />{t(`monitors.${k}`)}</label>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('isActive')} />{t('common.active')}</label></fieldset>
      </form>
    </Modal>
  );
}

export function MonitorsPage() {
  const { t } = useTranslation(); const [page, setPage] = useState(1); const [form, setForm] = useState<{ open: boolean; m?: MonRow | null }>({ open: false });
  const q = useApiQuery<Paged<MonRow>>('/monitors', { page, pageSize: 15 });
  return (
    <>
      <PageHeader title={t('nav.monitors')} subtitle={t('monitors.subtitle')} actions={<button className="btn-primary" onClick={() => setForm({ open: true, m: null })}><Plus className="h-4 w-4" />{t('monitors.add')}</button>} />
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[{ key: 'n', header: t('common.name'), render: (r) => <span className="font-medium">{r.fullName}</span> }, { key: 'e', header: t('common.email'), render: (r) => r.email }, { key: 'c', header: t('common.class'), render: (r) => r.className },
          { key: 's', header: t('common.status'), render: (r) => <StatusBadge kind="active" value={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
          { key: 'a', header: t('common.actions'), render: (r) => <button className="btn-ghost !p-1.5" aria-label={t('common.edit')} onClick={() => setForm({ open: true, m: r })}><Pencil className="h-4 w-4" /></button> }]}
        footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      <MonitorForm open={form.open} m={form.m} onClose={() => setForm({ open: false })} />
    </>
  );
}

export function MyClass() {
  const { t } = useTranslation(); const { user } = useAuth(); const q = useApiQuery<any>(`/classes/${user!.classId}`, undefined, { enabled: !!user!.classId });
  if (q.isLoading) return <Loading />; if (q.errorMessage) return <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} />; if (!q.data) return <ErrorState message={t('errors.NO_ASSIGNED_CLASS')} />;
  const c = q.data.class;
  return (
    <>
      <PageHeader title={c.name} subtitle={`${c.code} · ${c.academicYear?.name ?? ''} ${c.semester?.name ?? ''}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1"><h2 className="mb-2 font-semibold">{t('nav.students')} ({c.students.length})</h2><ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-navy-700">{c.students.map((s: any) => <li key={s.id} className="py-2 text-sm"><span className="font-mono text-xs text-slate-400">{s.studentCode}</span> {s.fullName}</li>)}</ul></div>
        <div className="lg:col-span-2"><h2 className="mb-2 font-semibold">{t('nav.schedule')}</h2><ScheduleList items={c.schedule} /></div>
      </div>
    </>
  );
}
