import dayjs from 'dayjs';
export const fmtDate = (d?: string | Date | null) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
export const fmtDateTime = (d?: string | Date | null) => (d ? dayjs(d).format('DD MMM YYYY, HH:mm') : '—');
export const pct = (n: number) => `${n.toFixed(1)}%`;
export const today = () => dayjs().format('YYYY-MM-DD');

/** CSV download generated in the browser (used for one-time imported credentials). */
export function downloadCsv(filename: string, rows: Record<string, string>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
export const STATUS_COLORS = { PRESENT: '#16a34a', LATE: '#f59e0b', ABSENT: '#dc2626', EXCUSED: '#3b82f6' } as const;
