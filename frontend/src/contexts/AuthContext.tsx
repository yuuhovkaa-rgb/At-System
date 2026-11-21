import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, refreshSession, setAccessToken, setAuthLostHandler } from '@/services/api';
import { User } from '@/types';
import { useTheme } from './ThemeContext';

interface AuthCtx {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updatePrefs: (p: Partial<Pick<User, 'language' | 'theme' | 'fullName'>>) => Promise<void>;
  reload: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const { setTheme } = useTheme();
  const qc = useQueryClient();

  /** A user's saved language/theme follow them to any device. */
  const adopt = useCallback((u: User) => { setUser(u); i18n.changeLanguage(u.language); setTheme(u.theme); }, [i18n, setTheme]);

  useEffect(() => {
    setAuthLostHandler(() => { setAccessToken(null); setUser(null); qc.clear(); });
    (async () => {
      if (await refreshSession()) { try { adopt((await api('/auth/me')).user); } catch { /* not signed in */ } }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    const r = await api('/auth/login', { body: { email, password } });
    setAccessToken(r.accessToken); qc.clear(); adopt(r.user); return r.user as User;
  };
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ } setAccessToken(null); setUser(null); qc.clear(); };
  const updatePrefs: AuthCtx['updatePrefs'] = async (p) => {
    if (p.language) i18n.changeLanguage(p.language); // instant, no reload
    if (p.theme) setTheme(p.theme);
    if (user) { try { setUser((await api('/auth/me', { method: 'PATCH', body: p })).user); } catch { /* preference saved locally anyway */ } }
  };
  const reload = async () => setUser((await api('/auth/me')).user);
  return <Ctx.Provider value={{ user, loading, login, logout, updatePrefs, reload }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
