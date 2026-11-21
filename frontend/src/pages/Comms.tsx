import { Check, Megaphone, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, EmptyState, ErrorState, Field, Loading, Modal, PageHeader, Pagination, DataTable, Spinner, StatusBadge, Toolbar } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useAction, useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/services/api';
import { ClassRow, Paged } from '@/types';
import { fmtDate, fmtDateTime } from '@/utils/format';

export function AnnouncementsPage() {
  const { t } = useTranslation(); const { user } = useAuth(); const { run, busy } = useAction(); const [page, setPage] = useState(1);
  const canPost = user!.role === 'ADMIN' || (user!.role === 'MONITOR' && user!.permissions?.canPublishAnnouncements);
  const [open, setOpen] = useState(false); const [del, setDel] = useState<any>(null); const [f, setF] = useState({ title: '', body: '', classId: '' });
  const q = useApiQuery<Paged<any>>('/announcements', { page, pageSize: 10 }); const classes = useApiQuery<Paged<ClassRow>>('/classes', { pageSize: 100 }, { enabled: user!.role === 'ADMIN' && open });
  const post = async () => { if (await run(() => api('/announcements', { body: { title: f.title, body: f.body, classId: f.classId || null } }), 'announcements.published')) { setF({ title: '', body: '', classId: '' }); setOpen(false); } };
  return (
    <>
      <PageHeader title={t('nav.announcements')} subtitle={t('announcements.subtitle')} actions={canPost && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('announcements.new')}</button>} />
      {q.isLoading ? <Loading /> : q.errorMessage ? <ErrorState message={q.errorMessage} onRetry={() => q.refetch()} /> : !q.data?.items.length ? <div className="card"><EmptyState text={t('announcements.empty')} /></div> : (
        <div className="space-y-4">{q.data.items.map((a) => (
          <article key={a.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Megaphone className="h-4 w-4" /></div>
            <div><h2 className="font-semibold">{a.title}</h2><p className="text-xs text-slate-500">{a.author} · {fmtDate(a.createdAt)} · {a.className ?? t('announcements.everyone')}</p></div></div>
            {(user!.role === 'ADMIN' || a.authorId === user!.id) && user!.role !== 'STUDENT' && <button className="btn-ghost !p-1.5 text-red-600" aria-label={t('common.delete')} onClick={() => setDel(a)}><Trash2 className="h-4 w-4" /></button>}</div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{a.body}</p></article>))}
          <div className="card"><Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} /></div></div>)}
      <Modal open={open} onClose={() => setOpen(false)} title={t('announcements.new')} footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</button><button className="btn-primary" disabled={busy || f.title.length < 3 || f.body.length < 3} onClick={post}>{busy && <Spinner className="h-4 w-4 text-white" />}{t('announcements.publish')}</button></>}>
        <div className="space-y-4"><Field label={t('announcements.title')}><input className="input" maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          {user!.role === 'ADMIN' && <Field label={t('announcements.audience')}><select className="input" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}><option value="">{t('announcements.everyone')}</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
          <Field label={t('announcements.body')}><textarea rows={5} className="input" maxLength={3000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field></div></Modal>
      <ConfirmDialog open={!!del} danger busy={busy} onClose={() => setDel(null)} title={t('common.delete')} message={del?.title ?? ''} onConfirm={async () => { await run(() => api(`/announcements/${del.id}`, { method: 'DELETE' }), 'toast.deleted'); setDel(null); }} />
    </>
  );
}

export function CorrectionsPage() {
  const { t } = useTranslation(); const { user } = useAuth(); const { run, busy } = useAction(); const [page, setPage] = useState(1); const [status, setStatus] = useState('PENDING'); const [rev, setRev] = useState<{ c: any; decision: 'APPROVED' | 'REJECTED' } | null>(null); const [note, setNote] = useState('');
  const q = useApiQuery<Paged<any>>('/attendance/corrections', { page, pageSize: 15, status }); const student = user!.role === 'STUDENT';
  const canReview = (c: any) => c.status === 'PENDING' && (user!.role === 'ADMIN' || (user!.role === 'MONITOR' && c.requestedByRole === 'STUDENT'));
  return (
    <>
      <PageHeader title={t('nav.corrections')} subtitle={student ? t('corrections.studentSubtitle') : t('corrections.subtitle')} />
      {student && <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-200">{t('corrections.howStudent')}</div>}
      <Toolbar><select className="input max-w-[180px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={t('common.status')}><option value="">{t('common.all')}</option>{['PENDING', 'APPROVED', 'REJECTED'].map((s) => <option key={s} value={s}>{t(`correction.${s}`)}</option>)}</select></Toolbar>
      <DataTable loading={q.isLoading} error={q.errorMessage} onRetry={() => q.refetch()} rows={q.data?.items} rowKey={(r) => r.id}
        columns={[{ key: 'd', header: t('common.date'), render: (r) => <>{fmtDate(r.date)}<span className="text-xs text-slate-400"> · {r.sessionNo}</span></> }, { key: 's', header: t('common.student'), render: (r) => <>{r.studentName}<span className="block font-mono text-xs text-slate-400">{r.studentCode}</span></> },
          { key: 'c', header: t('corrections.change'), render: (r) => <span className="flex items-center gap-1"><StatusBadge value={r.currentStatus} />→<StatusBadge value={r.requestedStatus} /></span> },
          { key: 'r', header: t('attendance.reason'), render: (r) => <span className="line-clamp-2 max-w-xs text-xs">{r.reason}{r.reviewNote && <span className="block text-slate-400">↳ {r.reviewNote}</span>}</span> },
          { key: 'b', header: t('corrections.requestedBy'), render: (r) => r.requestedBy }, { key: 'st', header: t('common.status'), render: (r) => <StatusBadge kind="correction" value={r.status} /> },
          { key: 'a', header: '', render: (r) => canReview(r) ? <div className="flex gap-1"><button className="btn-ghost !p-1.5 text-green-600" aria-label={t('corrections.approve')} onClick={() => setRev({ c: r, decision: 'APPROVED' })}><Check className="h-4 w-4" /></button><button className="btn-ghost !p-1.5 text-red-600" aria-label={t('corrections.reject')} onClick={() => setRev({ c: r, decision: 'REJECTED' })}><X className="h-4 w-4" /></button></div> : null }]}
        emptyText={t('corrections.empty')} footer={q.data && <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />} />
      <Modal open={!!rev} onClose={() => setRev(null)} title={rev?.decision === 'APPROVED' ? t('corrections.approve') : t('corrections.reject')} footer={<><button className="btn-secondary" onClick={() => setRev(null)}>{t('common.cancel')}</button><button className={rev?.decision === 'APPROVED' ? 'btn-primary' : 'btn-danger'} disabled={busy} onClick={async () => { await run(() => api(`/attendance/corrections/${rev!.c.id}/review`, { body: { decision: rev!.decision, note: note || undefined } }), 'toast.updated'); setRev(null); setNote(''); }}>{t('common.confirm')}</button></>}>
        <Field label={t('corrections.note')}><textarea rows={3} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field></Modal>
    </>
  );
}
