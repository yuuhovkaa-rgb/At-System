import { zodResolver } from '@hookform/resolvers/zod';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Field, PageHeader, Spinner } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useAction, useApiQuery } from '@/hooks/useApiQuery';
import { LANGS } from '@/i18n';
import { api } from '@/services/api';
import { usePasswordSchema } from './ResetPassword';

function PasswordForm() {
  const { t } = useTranslation(); const { logout } = useAuth(); const nav = useNavigate(); const toast = useToast(); const [err, setErr] = useState(''); const pw = usePasswordSchema();
  const schema = z.object({ currentPassword: z.string().min(1, t('validation.required')), newPassword: pw, confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: t('validation.mismatch') });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <form className="card space-y-4 p-5" noValidate onSubmit={handleSubmit(async (v) => { setErr(''); try { await api('/auth/change-password', { body: { currentPassword: v.currentPassword, newPassword: v.newPassword } }); toast(t('settings.passwordChanged')); await logout(); nav('/login'); } catch (e: any) { setErr(t(`errors.${e.code}`, { defaultValue: t('errors.UNKNOWN') })); } })}>
      <h2 className="font-semibold">{t('settings.changePassword')}</h2>{err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <Field label={t('settings.currentPassword')} error={errors.currentPassword?.message}><input type="password" autoComplete="current-password" className="input" {...register('currentPassword')} /></Field>
      <Field label={t('auth.newPassword')} error={errors.newPassword?.message} hint={t('validation.passwordRule')}><input type="password" autoComplete="new-password" className="input" {...register('newPassword')} /></Field>
      <Field label={t('auth.confirmPassword')} error={errors.confirm?.message}><input type="password" autoComplete="new-password" className="input" {...register('confirm')} /></Field>
      <button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}{t('settings.changePassword')}</button>
    </form>
  );
}

function Preferences() {
  const { t, i18n } = useTranslation(); const { updatePrefs } = useAuth(); const { theme } = useTheme();
  return (
    <div className="card space-y-5 p-5"><h2 className="font-semibold">{t('settings.preferences')}</h2>
      <div><p className="mb-2 text-sm font-medium">{t('settings.language')}</p><div className="flex gap-2">{LANGS.map((l) => <button key={l.code} aria-pressed={i18n.language === l.code} onClick={() => updatePrefs({ language: l.code })} className={i18n.language === l.code ? 'btn-primary' : 'btn-secondary'}>{l.label}</button>)}</div></div>
      <div><p className="mb-2 text-sm font-medium">{t('settings.theme')}</p><div className="flex gap-2">{(['light', 'dark'] as const).map((m) => <button key={m} aria-pressed={theme === m} onClick={() => updatePrefs({ theme: m })} className={theme === m ? 'btn-primary' : 'btn-secondary'}>{m === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{t(`settings.${m}`)}</button>)}</div></div>
    </div>
  );
}

export function SettingsPage() { const { t } = useTranslation(); return (<><PageHeader title={t('nav.settings')} subtitle={t('settings.accountSubtitle')} /><div className="grid gap-6 lg:grid-cols-2"><Preferences /><PasswordForm /></div></>); }

export function ProfilePage() {
  const { t } = useTranslation(); const { user, reload } = useAuth(); const { run, busy } = useAction(); const [name, setName] = useState(user!.fullName); const student = user!.role === 'STUDENT';
  const [contact, setContact] = useState({ phone: '', address: '' });
  const me = useApiQuery<{ phone: string | null; address: string | null }>('/student/me', undefined, { enabled: student });
  useEffect(() => { if (me.data) setContact({ phone: me.data.phone ?? '', address: me.data.address ?? '' }); }, [me.data]);
  const row = (k: string, v: string | null) => <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-navy-700"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v ?? '—'}</dd></div>;
  return (
    <>
      <PageHeader title={t('nav.profile')} subtitle={t('profile.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5"><h2 className="mb-2 font-semibold">{t('profile.info')}</h2><dl>{row(t('common.email'), user!.email)}{row(t('common.role'), t(`roles.${user!.role}`))}{student && row(t('students.code'), user!.studentCode)}</dl>
          <form className="mt-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); await run(() => api('/auth/me', { method: 'PATCH', body: { fullName: name } }), 'toast.saved'); await reload(); }}>
            <Field label={t('common.name')}><input className="input" minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></Field><button className="btn-primary" disabled={busy || name.trim().length < 2}>{t('common.save')}</button></form></div>
        {student ? (
          <form className="card space-y-3 p-5" onSubmit={async (e) => { e.preventDefault(); await run(() => api('/student/me', { method: 'PATCH', body: { phone: contact.phone || null, address: contact.address || null } }), 'toast.saved'); }}>
            <h2 className="font-semibold">{t('profile.contact')}</h2><p className="text-xs text-slate-400">{t('profile.contactHint')}</p>
            <Field label={t('common.phone')}><input className="input" maxLength={30} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></Field>
            <Field label={t('common.address')}><input className="input" maxLength={200} value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></Field>
            <button className="btn-primary" disabled={busy}>{t('common.save')}</button></form>
        ) : <Preferences />}
        <PasswordForm />
      </div>
    </>
  );
}
