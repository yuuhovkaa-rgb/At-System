import { TFunction } from 'i18next';
import { ApiError } from '@/services/api';

/** Turns any thrown value into a translated, user-facing message. */
export function errMsg(e: unknown, t: TFunction): string {
  if (e instanceof ApiError) {
    if (e.code === 'VALIDATION_ERROR' && e.details?.length) return `${t('errors.VALIDATION_ERROR')}: ${e.details.map((d) => d.path || d.message).join(', ')}`;
    return t(`errors.${e.code}`, { defaultValue: t('errors.UNKNOWN') });
  }
  return t('errors.UNKNOWN');
}
