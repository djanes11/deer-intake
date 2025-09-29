'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = { id: number; text: string; tone?: 'ok'|'err'|'info' };
type Ctx = { toast: (text: string, tone?: Toast['tone']) => void };

const ToastCtx = createContext<Ctx>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, tone: Toast['tone']='info') => {
    const id = Date.now() + Math.random();
    setItems(p => [...p, { id, text, tone }]);
    setTimeout(() => setItems(p => p.filter(t => t.id !== id)), 2500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.tone==='ok'?'ok': t.tone==='err'?'err':''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(){ return useContext(ToastCtx); }
