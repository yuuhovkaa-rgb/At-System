import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'error' | 'info';
interface T { id: number; kind: Kind; text: string }
const Ctx = createContext<{ toast: (text: string, kind?: Kind) => void }>(null as never);
let n = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const toast = useCallback((text: string, kind: Kind = 'success') => {
    const id = ++n; setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  const color = { success: 'text-green-600', error: 'text-red-600', info: 'text-brand-600' };
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => { const I = Icon[t.kind]; return (
          <div key={t.id} className="card flex animate-fade-in items-start gap-3 p-3 shadow-lg">
            <I className={`mt-0.5 h-5 w-5 shrink-0 ${color[t.kind]}`} />
            <p className="flex-1 text-sm">{t.text}</p>
            <button aria-label="close" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}><X className="h-4 w-4 text-slate-400" /></button>
          </div>); })}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx).toast;
