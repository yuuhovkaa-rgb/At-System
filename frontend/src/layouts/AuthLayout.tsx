import { ShieldCheck } from 'lucide-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch, ThemeToggle } from './AppLayout';

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-navy-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><ShieldCheck className="h-6 w-6" /></div><span className="text-xl font-bold">{t('common.appName')}</span></div>
        <div><h2 className="max-w-md text-4xl font-semibold leading-tight">{t('auth.hero')}</h2><p className="mt-4 max-w-md text-brand-100">{t('auth.heroSub')}</p></div>
        <p className="text-sm text-brand-200">{t('common.appFull')}</p>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex justify-end gap-2 p-4"><LanguageSwitch /><ThemeToggle /></div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12"><div className="card w-full max-w-md animate-fade-in p-6 sm:p-8"><h1 className="text-2xl font-semibold">{title}</h1>{subtitle && <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}{children}</div></div>
      </div>
    </div>
  );
}
