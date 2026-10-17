import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'info';
}

const ToastCtx = createContext<(message: string, tone?: ToastItem['tone']) => void>(() => {});

/** Avisos cortos arriba: no tapan los botones de la zona del pulgar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, tone: ToastItem['tone'] = 'success') => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {createPortal(
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4">
          {items.map((t) => (
            <div key={t.id} className="flex animate-rise-in items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[15px] font-medium text-bg shadow-lift">
              {t.tone === 'success' ? <CheckCircle2 className="h-5 w-5 text-positive" /> : <Info className="h-5 w-5" />}
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx);
