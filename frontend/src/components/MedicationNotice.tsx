import { Pill } from "lucide-react";

export function MedicationNotice() {
  return (
    <div
      role="note"
      className="flex gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-100"
    >
      <Pill className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>MediAssist can't advise on doses or changing medicines. A pharmacist or your prescriber can.</p>
    </div>
  );
}
