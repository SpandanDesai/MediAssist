import { AlertTriangle, Hospital, Phone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

const emergencyNumber = import.meta.env.VITE_EMERGENCY_NUMBER || "112";

export function EmergencyAlert({ onClose, compact = false }: { onClose?: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-50" : "fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"} role="alertdialog" aria-modal={!compact} aria-labelledby="emergency-heading">
      <div className={compact ? "" : "w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900 dark:bg-slate-900 sm:p-8"}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/30"><AlertTriangle className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Urgent safety notice</p><h2 id="emergency-heading" className="mt-1 text-xl font-bold text-rose-950 dark:text-white">Medical emergency detected</h2></div>{onClose && <button onClick={onClose} aria-label="Close emergency notice" className="rounded-lg p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950"><X className="h-5 w-5" /></button>}</div>
            <p className="mt-3 text-sm leading-6 text-rose-800 dark:text-rose-100">Call local emergency services immediately or go to the nearest emergency department. Do not wait for an AI response.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a href={`tel:${emergencyNumber}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"><Phone className="h-4 w-4" />Call {emergencyNumber}</a>
          <Link to="/hospitals" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-950 dark:text-rose-200"><Hospital className="h-4 w-4" />Find emergency care</Link>
        </div>
        {!compact && <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">MediAssist cannot provide emergency care or a diagnosis.</p>}
      </div>
    </div>
  );
}

export function EmergencyInlineNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
      <strong>Need immediate help?</strong> For chest pain, trouble breathing, severe bleeding, stroke symptoms, loss of consciousness, or thoughts of self-harm, call emergency services now.
    </div>
  );
}
