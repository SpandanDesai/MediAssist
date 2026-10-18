import { useEffect, useRef } from "react";
import { AlertTriangle, ExternalLink, Hospital, Phone, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { CrisisResource, NearbyFacility } from "../types";
import { Button } from "./ui/button";

const emergencyNumber = import.meta.env.VITE_EMERGENCY_NUMBER || "112";

interface Props {
  onClose?: () => void;
  compact?: boolean;
  category?: string;
  crisisResources?: CrisisResource[];
  nearestHospitals?: NearbyFacility[];
}

export function EmergencyAlert({ onClose, compact = false, category, crisisResources, nearestHospitals }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isCrisis = Boolean(
    category?.toLowerCase().includes("suicid") ||
    category?.toLowerCase().includes("self-harm") ||
    category?.toLowerCase().includes("crisis")
  );

  useEffect(() => {
    if (compact) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact, onClose]);

  return (
    <div
      className={
        compact
          ? `rounded-xl border p-4 text-ink ${isCrisis ? "border-brand/30 bg-brand-tint" : "border-danger/30 bg-danger-tint"}`
          : "fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
      }
      role="alertdialog"
      aria-modal={!compact}
      aria-labelledby="emergency-heading"
      aria-describedby="emergency-body"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={
          compact
            ? "outline-none"
            : `max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-surface p-6 shadow-overlay outline-none sm:p-8 ${isCrisis ? "border-brand/30" : "border-danger/30"}`
        }
      >
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isCrisis ? "bg-brand text-brand-fg" : "bg-danger text-danger-fg"}`}>
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="emergency-heading" className="text-xl font-bold text-ink">
                  {isCrisis ? "Immediate support is available" : "Medical emergency detected"}
                </h2>
                {category && <p className={`mt-1 text-sm font-medium ${isCrisis ? "text-brand" : "text-danger"}`}>{category}</p>}
              </div>
              {onClose && (
                <button onClick={onClose} aria-label="Close emergency notice" className="rounded-lg p-2 text-ink-2 hover:bg-surface-alt">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <p id="emergency-body" className="mt-3 text-sm leading-6 text-ink-2 font-read">
              {isCrisis
                ? "You are not alone, and there is caring, confidential support available 24/7. Please reach out to a crisis counselor or emergency services immediately."
                : "Call local emergency services immediately or go to the nearest emergency department. Do not wait for an AI response."}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {isCrisis ? (
            <a href="tel:988" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand-strong">
              <Phone className="h-4 w-4" aria-hidden="true" />Call / Text 988 (Lifeline)
            </a>
          ) : (
            <a href={`tel:${emergencyNumber}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-sm font-semibold text-danger-fg transition-opacity hover:opacity-90">
              <Phone className="h-4 w-4" aria-hidden="true" />Call {emergencyNumber}
            </a>
          )}
          <Link to="/hospitals" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rule bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt">
            <Hospital className="h-4 w-4" aria-hidden="true" />Find emergency care
          </Link>
        </div>
        {!!crisisResources?.length && (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Crisis resources</p>
            {crisisResources.map((resource, index) => (
              <div key={`${resource.label}-${index}`} className="rounded-lg border border-rule bg-surface-alt p-3 text-sm">
                <p className="font-semibold text-ink">{resource.label}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{resource.detail}</p>
                <div className="mt-1.5 flex flex-wrap gap-3 text-[13px] font-bold text-brand">
                  {resource.phone && <a href={`tel:${resource.phone}`}>Call {resource.phone}</a>}
                  {resource.url && <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></a>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!!nearestHospitals?.length && (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Nearby facilities</p>
            {nearestHospitals.slice(0, 3).map((hospital) => (
              <div key={hospital.id} className="rounded-lg border border-rule p-3 text-sm">
                <p className="font-semibold text-ink">{hospital.name}</p>
                <p className="mt-0.5 text-xs text-ink-2">
                  {[hospital.type, hospital.distance_km != null ? `${hospital.distance_km} km` : null].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-1.5 flex gap-3 text-[13px] font-bold text-brand">
                  {hospital.phone && <a href={`tel:${hospital.phone}`}>Call</a>}
                  {hospital.maps_url && <a href={hospital.maps_url} target="_blank" rel="noreferrer">Directions</a>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!compact && <p className="mt-4 text-center text-[13px] text-ink-2">MediAssist cannot provide emergency care or a diagnosis.</p>}
        {onClose && compact && <Button className="mt-3" variant="outline" onClick={onClose}>Dismiss</Button>}
      </div>
    </div>
  );
}

export function EmergencyInlineNotice() {
  return (
    <div role="note" className="flex items-start gap-2.5 rounded-xl border border-med/30 bg-med-tint px-4 py-3 text-sm text-ink">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-med" aria-hidden="true" />
      <p className="leading-6"><strong className="text-med">Need immediate help?</strong> For chest pain, trouble breathing, severe bleeding, stroke symptoms, loss of consciousness, or thoughts of self-harm, call emergency services now.</p>
    </div>
  );
}
