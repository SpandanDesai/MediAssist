import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

type ToastTone = "success" | "error" | "info";
interface Toast { id: number; title: string; message?: string; tone: ToastTone }
interface ToastContextValue { showToast: (toast: Omit<Toast, "id">) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByTone = { success: CheckCircle2, error: XCircle, info: Info };

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
            <div key={toast.id} className={cn("pointer-events-auto flex gap-3 rounded-2xl border bg-white p-4 shadow-xl dark:bg-slate-900", toast.tone === "error" ? "border-rose-200 dark:border-rose-900" : toast.tone === "success" ? "border-emerald-200 dark:border-emerald-900" : "border-sky-200 dark:border-sky-900")}>
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", toast.tone === "error" ? "text-rose-500" : toast.tone === "success" ? "text-emerald-500" : "text-sky-500")} />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-white">{toast.title}</p>{toast.message && <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{toast.message}</p>}</div>
              <button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} className="text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
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
