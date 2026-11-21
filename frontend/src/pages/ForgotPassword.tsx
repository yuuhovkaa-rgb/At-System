import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Field, Spinner } from '@/components/ui';
import AuthLayout from '@/layouts/AuthLayout';
import { api } from '@/services/api';
import { errMsg } from '@/utils/errors';

export default function ForgotPassword() {
  const { t } = useTranslation(); const [sent, setSent] = useState(false); const [err, setErr] = useState('');
  const schema = z.object({ email: z.string().email(t('validation.email')) });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {sent ? (
        <div className="space-y-4 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-green-500" /><p className="text-sm">{t('auth.linkSent')}</p><Link className="btn-secondary w-full" to="/login">{t('auth.backToLogin')}</Link></div>
      ) : (
        <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => { setErr(''); try { await api('/auth/forgot-password', { body: v }); setSent(true); } catch (e) { setErr(errMsg(e, t)); } })}>
          {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <Field label={t('common.email')} error={errors.email?.message}><input className="input" type="email" {...register('email')} /></Field>
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}{t('auth.sendLink')}</button>
          <Link className="block text-center text-sm text-brand-600 hover:underline" to="/login">{t('auth.backToLogin')}</Link>
        </form>)}
    </AuthLayout>
  );
}
