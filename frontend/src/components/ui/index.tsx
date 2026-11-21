import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Status } from '@/types';

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} aria-label="loading" />;
export const Loading = () => <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>;

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'brand', hint }: { label: string; value: ReactNode; icon?: ReactNode; tone?: 'brand' | 'green' | 'red' | 'amber' | 'sky' | 'slate'; hint?: string }) {
  const tones = { brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/30', green: 'bg-green-50 text-green-600 dark:bg-green-900/30', red: 'bg-red-50 text-red-600 dark:bg-red-900/30',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30', sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30', slate: 'bg-slate-100 text-slate-600 dark:bg-navy-700' };
  return (
    <div className="card flex items-center gap-4 p-4">
      {icon && <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', tones[tone])}>{icon}</div>}
      <div className="min-w-0"><p className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="text-2xl font-semibold tabular-nums">{value}</p>{hint && <p className="text-xs text-slate-400">{hint}</p>}</div>
    </div>
  );
}

const badge: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  LATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', EXCUSED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  OPEN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', SUBMITTED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', INACTIVE: 'bg-slate-200 text-slate-600 dark:bg-navy-700 dark:text-slate-300',
};
export function StatusBadge({ value, kind = 'status' }: { value: string; kind?: 'status' | 'session' | 'correction' | 'active' }) {
  const { t } = useTranslation();
  const label = kind === 'status' ? t(`status.${value}`) : kind === 'session' ? t(`sessionStatus.${value}`) : kind === 'correction' ? t(`correction.${value}`) : t(`common.${value === 'ACTIVE' ? 'active' : 'inactive'}`);
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', badge[value] ?? badge.INACTIVE)}>{label}</span>;
}
export const StatusDot = ({ s }: { s: Status }) => <span className={clsx('inline-block h-2.5 w-2.5 rounded-full', { PRESENT: 'bg-green-500', LATE: 'bg-amber-500', ABSENT: 'bg-red-500', EXCUSED: 'bg-sky-500' }[s])} />;

export function EmptyState({ text, action }: { text?: string; action?: ReactNode }) {
  const { t } = useTranslation();
  return <div className="flex flex-col items-center gap-3 px-4 py-14 text-center text-slate-500"><Inbox className="h-10 w-10 text-slate-300 dark:text-navy-700" /><p className="text-sm">{text ?? t('common.noData')}</p>{action}</div>;
}
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return <div className="flex flex-col items-center gap-3 px-4 py-14 text-center"><AlertTriangle className="h-10 w-10 text-red-400" /><p className="text-sm text-red-600 dark:text-red-400">{message ?? t('errors.UNKNOWN')}</p>{onRetry && <button className="btn-secondary" onClick={onRetry}>{t('common.retry')}</button>}</div>;
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => { if (!open) return; const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx('card flex max-h-[92vh] w-full animate-fade-in flex-col rounded-b-none sm:rounded-b-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-navy-700"><h2 className="text-lg font-semibold">{title}</h2><button className="btn-ghost !p-1.5" onClick={onClose} aria-label="close"><X className="h-5 w-5" /></button></div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-navy-700">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger, busy }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; danger?: boolean; busy?: boolean }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<>
      <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}{t('common.confirm')}</button></>}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </Modal>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}{error && <span className="mt-1 block text-xs text-red-600" role="alert">{error}</span>}</label>;
}

export function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (p: number) => void }) {
  const { t } = useTranslation();
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm dark:border-navy-700">
      <span className="text-slate-500">{t('common.total')}: {total}</span>
      <div className="flex items-center gap-2">
        <button className="btn-secondary !px-2" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('common.previous')}><ChevronLeft className="h-4 w-4" /></button>
        <span className="tabular-nums">{t('common.pageOf', { page, total: totalPages })}</span>
        <button className="btn-secondary !px-2" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label={t('common.next')}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string }
export function DataTable<T>({ columns, rows, loading, error, onRetry, rowKey, emptyText, footer }: {
  columns: Column<T>[]; rows?: T[]; loading?: boolean; error?: string | null; onRetry?: () => void; rowKey: (r: T) => string; emptyText?: string; footer?: ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={onRetry} /> : !rows?.length ? <EmptyState text={emptyText} /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-navy-700 dark:bg-navy-900/60"><tr>{columns.map((c) => <th key={c.key} className="th">{c.header}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
              {rows.map((r) => <tr key={rowKey(r)} className="hover:bg-slate-50/70 dark:hover:bg-navy-700/40">{columns.map((c) => <td key={c.key} className={clsx('td', c.className)}>{c.render(r)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )}
      {footer}
    </div>
  );
}

export const Toolbar = ({ children }: { children: ReactNode }) => <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
export function ProgressBar({ value }: { value: number }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-navy-700"><div className={clsx('h-full rounded-full transition-all', value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}
