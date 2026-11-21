import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/services/api';
import { errMsg } from '@/utils/errors';

export function useApiQuery<T = any>(path: string, query?: Record<string, unknown>, opts?: { enabled?: boolean; refetchInterval?: number }) {
  const { t } = useTranslation();
  const q = useQuery<T, Error>({ queryKey: [path, query], queryFn: () => api<T>(path, { query }), ...opts });
  return Object.assign(q, { errorMessage: q.error ? errMsg(q.error, t) : null });
}

/** Runs a mutation with a busy flag, success/error toasts, and refreshes cached data afterwards. */
export function useAction() {
  const { t } = useTranslation(); const toast = useToast(); const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  const run = async <R,>(fn: () => Promise<R>, okKey?: string): Promise<R | undefined> => {
    setBusy(true);
    try { const r = await fn(); if (okKey) toast(t(okKey)); await qc.invalidateQueries(); return r; }
    catch (e) { toast(errMsg(e, t), 'error'); return undefined; }
    finally { setBusy(false); }
  };
  return { run, busy };
}
