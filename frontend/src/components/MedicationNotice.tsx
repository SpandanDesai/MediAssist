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
      className="flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-surface-alt px-4 py-3 text-sm text-ink"
    >
      <Pill className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
      <p className="min-w-0 flex-1 font-read">MediAssist can't advise on doses or changing medicines. A pharmacist or your prescriber can.</p>
      {onReview && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onReview}
          disabled={reviewing}
          className="shrink-0"
        >
          {reviewing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
          Check my profile
        </Button>
      )}
    </div>
  );
}
