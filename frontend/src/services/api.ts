export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: { path: string; message: string }[]) { super(message ?? code); }
}

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const setAuthLostHandler = (f: () => void) => { onAuthLost = f; };

let refreshing: Promise<boolean> | null = null;
/** Exchanges the httpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (r) => { if (!r.ok) return false; accessToken = (await r.json()).accessToken; return true; })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

type Opts = { method?: string; body?: unknown; query?: Record<string, unknown>; raw?: boolean; form?: FormData };

export async function api<T = any>(path: string, opts: Opts = {}, retry = true): Promise<T> {
  const qs = opts.query ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])) : '';
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs}`, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'), credentials: 'include',
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    });
  } catch { throw new ApiError(0, 'NETWORK'); }
  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    if (await refreshSession()) return api<T>(path, opts, false);
    onAuthLost?.();
  }
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new ApiError(res.status, j?.error?.code ?? 'UNKNOWN', j?.error?.message, Array.isArray(j?.error?.details) ? j.error.details : undefined);
  }
  if (opts.raw) return res as unknown as T;
  return res.json().catch(() => ({} as T));
}

/** Authenticated file download (CSV/XLSX/PDF) — the token lives in memory, so a plain <a href> would not work. */
export async function download(path: string, query: Record<string, unknown>, fallbackName: string) {
  const res = await api<Response>(path, { query, raw: true });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
