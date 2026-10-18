import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

type ToastTone = "success" | "error" | "info";
interface Toast { id: number; title: string; message?: string; tone: ToastTone }
interface ToastContextValue { showToast: (toast: Omit<Toast, "id">) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByTone = { success: CheckCircle2, error: XCircle, info: Info };
const borderByTone = { success: "border-low/30", error: "border-danger/30", info: "border-brand/30" };
const iconColorByTone = { success: "text-low", error: "text-danger", info: "text-brand" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4600);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-5 z-[100] flex max-w-sm flex-col gap-3 sm:left-auto sm:right-5">
        {toasts.map((toast) => {
          const Icon = iconByTone[toast.tone];
          return (
            <div key={toast.id} className={cn("pointer-events-auto flex gap-3 rounded-xl border bg-surface p-4 shadow-overlay", borderByTone[toast.tone])}>
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColorByTone[toast.tone])} />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{toast.title}</p>{toast.message && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{toast.message}</p>}</div>
              <button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} className="text-ink-2 hover:text-ink" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
