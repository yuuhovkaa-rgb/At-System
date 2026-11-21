import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>(null as never);
const read = (): Theme => { try { return localStorage.getItem('at.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } }; // default: light

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, set] = useState<Theme>(read);
  const setTheme = useCallback((t: Theme) => set(t), []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('at.theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return <Ctx.Provider value={{ theme, setTheme, toggle: () => set((t) => (t === 'dark' ? 'light' : 'dark')) }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
