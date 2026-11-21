import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, BarChart3, CalendarDays, CalendarRange, CheckCheck, ChevronDown, ClipboardCheck, ClipboardList, FileBarChart, GraduationCap, History, LayoutDashboard, Languages, LogOut, Megaphone, Menu, Moon, ScrollText, Search, Settings, ShieldCheck, Sun, UserCircle, UserCog, Users, Users2, X, FileClock, School } from 'lucide-react';
import { ComponentType, FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LANGS } from '@/i18n';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fmtDateTime } from '@/utils/format';
import { Role } from '@/types';

type Item = { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean };
export const NAV: Record<Role, Item[]> = {
  ADMIN: [
    { to: '/admin', label: 'nav.dashboard', icon: LayoutDashboard, end: true }, { to: '/admin/students', label: 'nav.students', icon: GraduationCap },
    { to: '/admin/classes', label: 'nav.classes', icon: School }, { to: '/admin/monitors', label: 'nav.monitors', icon: UserCog },
    { to: '/admin/attendance', label: 'nav.attendanceOverview', icon: ClipboardList }, { to: '/admin/corrections', label: 'nav.corrections', icon: FileClock },
    { to: '/admin/reports', label: 'nav.reports', icon: FileBarChart }, { to: '/admin/analytics', label: 'nav.analytics', icon: BarChart3 },
    { to: '/admin/users', label: 'nav.users', icon: Users2 }, { to: '/admin/audit-logs', label: 'nav.auditLogs', icon: ScrollText },
    { to: '/admin/announcements', label: 'nav.announcements', icon: Megaphone }, { to: '/admin/settings', label: 'nav.systemSettings', icon: Settings },
    { to: '/admin/profile', label: 'nav.profile', icon: UserCircle },
  ],
  MONITOR: [
    { to: '/monitor', label: 'nav.dashboard', icon: LayoutDashboard, end: true }, { to: '/monitor/class', label: 'nav.myClass', icon: School },
    { to: '/monitor/students', label: 'nav.studentList', icon: Users }, { to: '/monitor/take-attendance', label: 'nav.takeAttendance', icon: ClipboardCheck },
    { to: '/monitor/history', label: 'nav.history', icon: History }, { to: '/monitor/reports', label: 'nav.reports', icon: FileBarChart },
    { to: '/monitor/corrections', label: 'nav.corrections', icon: FileClock }, { to: '/monitor/announcements', label: 'nav.announcements', icon: Megaphone },
    { to: '/monitor/profile', label: 'nav.profile', icon: UserCircle }, { to: '/monitor/settings', label: 'nav.settings', icon: Settings },
  ],
  STUDENT: [
    { to: '/student', label: 'nav.dashboard', icon: LayoutDashboard, end: true }, { to: '/student/attendance', label: 'nav.myAttendance', icon: ClipboardCheck },
    { to: '/student/calendar', label: 'nav.calendar', icon: CalendarDays }, { to: '/student/history', label: 'nav.history', icon: History },
    { to: '/student/schedule', label: 'nav.schedule', icon: CalendarRange }, { to: '/student/corrections', label: 'nav.corrections', icon: FileClock },
    { to: '/student/announcements', label: 'nav.announcements', icon: Megaphone }, { to: '/student/profile', label: 'nav.profile', icon: UserCircle },
    { to: '/student/settings', label: 'nav.settings', icon: Settings },
  ],
};
export const baseOf = (r: Role) => ({ ADMIN: '/admin', MONITOR: '/monitor', STUDENT: '/student' }[r]);

function useOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, [onOut]);
  return ref;
}

function Dropdown({ button, children, align = 'right' }: { button: (o: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'right' | 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{button(open)}</div>
      {open && <div className={clsx('card absolute z-40 mt-2 w-72 animate-fade-in p-1 shadow-xl', align === 'right' ? 'right-0' : 'left-0')}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

function Notifications() {
  const { t } = useTranslation(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api('/notifications', { query: { pageSize: 8 } }), refetchInterval: 30_000 });
  const read = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const unread = q.data?.unread ?? 0;
  return (
    <Dropdown button={() => <button className="btn-ghost relative !p-2" aria-label={t('nav.notifications')}><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}</button>}>
      {() => (
        <div className="w-[min(88vw,320px)]">
          <div className="flex items-center justify-between px-3 py-2"><span className="text-sm font-semibold">{t('nav.notifications')}</span>{unread > 0 && <button className="flex items-center gap-1 text-xs text-brand-600" onClick={() => readAll.mutate()}><CheckCheck className="h-3.5 w-3.5" />{t('notif.markAll')}</button>}</div>
          <div className="max-h-80 overflow-y-auto">
            {!q.data?.items.length ? <p className="px-3 py-8 text-center text-sm text-slate-400">{t('notif.empty')}</p> : q.data.items.map((n: any) => (
              <button key={n.id} onClick={() => !n.isRead && read.mutate(n.id)} className={clsx('block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-navy-700', !n.isRead && 'bg-brand-50/60 dark:bg-brand-900/20')}>
                <p className="text-sm">{t(`notif.${n.type}`, { ...n.params, defaultValue: n.type })}</p><p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
              </button>))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

export function LanguageSwitch() {
  const { i18n } = useTranslation(); const { updatePrefs } = useAuth();
  return (
    <div className="flex items-center rounded-lg border border-slate-300 p-0.5 dark:border-navy-700" role="group" aria-label="language">
      <Languages className="mx-1.5 h-4 w-4 text-slate-400" />
      {LANGS.map((l) => <button key={l.code} onClick={() => updatePrefs({ language: l.code })} aria-pressed={i18n.language === l.code} className={clsx('rounded-md px-2 py-1 text-xs font-semibold transition-colors', i18n.language === l.code ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700')}>{l.short}</button>)}
    </div>
  );
}
export function ThemeToggle() {
  const { theme } = useTheme(); const { updatePrefs } = useAuth(); const { t } = useTranslation();
  return <button className="btn-ghost !p-2" aria-label={t('settings.theme')} onClick={() => updatePrefs({ theme: theme === 'dark' ? 'light' : 'dark' })}>{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>;
}

export default function AppLayout() {
  const { user, logout } = useAuth(); const { t } = useTranslation(); const nav = useNavigate(); const loc = useLocation();
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  useEffect(() => setOpen(false), [loc.pathname]);
  if (!user) return null;
  const base = baseOf(user.role);
  const onSearch = (e: FormEvent) => { e.preventDefault(); nav(`${base}/students?q=${encodeURIComponent(q)}`); };
  const sidebar = (
    <nav className="flex h-full flex-col bg-white dark:bg-navy-800">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5 dark:border-navy-700"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-bold leading-tight">{t('common.appName')}</p><p className="text-[11px] text-slate-400">{t(`roles.${user.role}`)}</p></div></div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV[user.role].map((i) => <li key={i.to}><NavLink to={i.to} end={i.end} className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-700')}><i.icon className="h-[18px] w-[18px] shrink-0" />{t(i.label)}</NavLink></li>)}
      </ul>
    </nav>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 dark:border-navy-700 lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in shadow-2xl">{sidebar}<button className="btn-ghost absolute right-2 top-3 !p-1.5" onClick={() => setOpen(false)} aria-label="close"><X className="h-5 w-5" /></button></aside></div>}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/85 px-3 backdrop-blur dark:border-navy-700 dark:bg-navy-800/85 sm:px-6">
          <button className="btn-ghost !p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="menu"><Menu className="h-5 w-5" /></button>
          {user.role !== 'STUDENT' ? <form onSubmit={onSearch} className="relative hidden max-w-xs flex-1 sm:block"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input !pl-9" placeholder={t('common.searchStudents')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} /></form> : <div className="flex-1" />}
          <div className="flex-1" />
          <LanguageSwitch /><ThemeToggle /><Notifications />
          <Dropdown button={() => <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{user.fullName.trim()[0]?.toUpperCase()}</span><ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" /></button>}>
            {(close) => (<>
              <div className="border-b border-slate-100 px-3 py-2 dark:border-navy-700"><p className="truncate text-sm font-semibold">{user.fullName}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700" onClick={() => { close(); nav(`${base}/profile`); }}><UserCircle className="h-4 w-4" />{t('nav.profile')}</button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={async () => { close(); await logout(); nav('/login'); }}><LogOut className="h-4 w-4" />{t('nav.logout')}</button></>)}
          </Dropdown>
        </header>
        <main className="mx-auto max-w-7xl animate-fade-in p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
