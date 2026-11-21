import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Field, Spinner } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import AuthLayout from '@/layouts/AuthLayout';
import { api } from '@/services/api';
import { errMsg } from '@/utils/errors';

export const usePasswordSchema = () => {
  const { t } = useTranslation();
  return z.string().min(8, t('validation.passwordMin')).regex(/[A-Za-z]/, t('validation.passwordLetter')).regex(/[0-9]/, t('validation.passwordDigit'));
};

export default function ResetPassword() {
  const { t } = useTranslation(); const toast = useToast(); const nav = useNavigate(); const [params] = useSearchParams(); const [err, setErr] = useState('');
  const pw = usePasswordSchema();
  const schema = z.object({ newPassword: pw, confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: t('validation.mismatch') });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const token = params.get('token');
  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      {!token ? <div className="space-y-4"><p className="text-sm text-red-600">{t('errors.RESET_TOKEN_INVALID')}</p><Link className="btn-secondary w-full" to="/forgot-password">{t('auth.forgotTitle')}</Link></div> : (
        <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => { setErr(''); try { await api('/auth/reset-password', { body: { token, newPassword: v.newPassword } }); toast(t('auth.resetOk')); nav('/login'); } catch (e) { setErr(errMsg(e, t)); } })}>
          {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <Field label={t('auth.newPassword')} error={errors.newPassword?.message} hint={t('validation.passwordRule')}><input className="input" type="password" autoComplete="new-password" {...register('newPassword')} /></Field>
          <Field label={t('auth.confirmPassword')} error={errors.confirm?.message}><input className="input" type="password" autoComplete="new-password" {...register('confirm')} /></Field>
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}{t('auth.resetButton')}</button>
        </form>)}
    </AuthLayout>
  );
}
