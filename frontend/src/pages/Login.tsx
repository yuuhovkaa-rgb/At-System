import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Field, Spinner } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import AuthLayout from '@/layouts/AuthLayout';
import { baseOf } from '@/layouts/AppLayout';
import { errMsg } from '@/utils/errors';

export default function Login() {
  const { t } = useTranslation(); const { user, login } = useAuth(); const nav = useNavigate();
  const [err, setErr] = useState(''); const [show, setShow] = useState(false);
  const schema = z.object({ email: z.string().email(t('validation.email')), password: z.string().min(1, t('validation.required')) });
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to={baseOf(user.role)} replace />;
  const demo = [['admin@atsystem.test', 'Admin@12345', 'ADMIN'], ['monitor1@atsystem.test', 'Monitor@12345', 'MONITOR'], ['student1@atsystem.test', 'Student@12345', 'STUDENT']];
  return (
    <AuthLayout title={t('auth.welcomeBack')} subtitle={t('auth.loginSubtitle')}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => { setErr(''); try { const u = await login(v.email, v.password); nav(baseOf(u.role), { replace: true }); } catch (e) { setErr(errMsg(e, t)); } })}>
        {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{err}</div>}
        <Field label={t('common.email')} error={errors.email?.message}><input className="input" type="email" autoComplete="username" {...register('email')} /></Field>
        <Field label={t('common.password')} error={errors.password?.message}>
          <div className="relative"><input className="input !pr-10" type={show ? 'text' : 'password'} autoComplete="current-password" {...register('password')} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-2.5 text-slate-400" aria-label={t('auth.togglePassword')}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
        </Field>
        <div className="text-right"><Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">{t('auth.forgot')}</Link></div>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}{t('auth.signIn')}</button>
      </form>
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-3 dark:border-navy-700">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">{t('auth.demo')}</p>
          <div className="flex flex-wrap gap-2">{demo.map(([e, p, r]) => <button key={r} type="button" className="btn-secondary !py-1 text-xs" onClick={() => { setValue('email', e); setValue('password', p); }}>{t(`roles.${r}`)}</button>)}</div>
        </div>)}
    </AuthLayout>
  );
}
