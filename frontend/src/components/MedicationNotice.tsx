import { Loader2, Pill, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";

export function MedicationNotice({
  onReview,
  reviewing = false,
}: {
  onReview?: () => void;
  reviewing?: boolean;
}) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-100"
    >
      <Pill className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">MediAssist can't advise on doses or changing medicines. A pharmacist or your prescriber can.</p>
      {onReview && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onReview}
          disabled={reviewing}
          className="shrink-0 border-violet-300 text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-100"
        >
          {reviewing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
          Check my profile
        </Button>
      )}
    </div>
  );
}
