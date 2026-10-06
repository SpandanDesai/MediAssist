from pathlib import Path
ROOT = Path(r"c:\Users\Spandan\Documents\GitHub\MediAssist")

(ROOT / "frontend/src/components/HealthAnalysisCard.tsx").write_text(r'''import { AlertTriangle, ArrowRight, CircleHelp, HeartPulse, MapPinned, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { HealthAnalysis } from "../types";
import { titleCase, urgencyClass } from "../lib/utils";
import { Badge } from "./ui/badge";

interface Props {
  analysis?: HealthAnalysis;
  onFollowUp?: (question: string) => void;
}

export function HealthAnalysisCard({ analysis, onFollowUp }: Props) {
  if (
    !analysis ||
    (!analysis.possible_conditions?.length &&
      !analysis.urgency &&
      !analysis.recommendation &&
      !analysis.follow_up_questions?.length &&
      !analysis.crisis_resources?.length &&
      !analysis.nearest_hospitals?.length)
  ) {
    return null;
  }
  const urgent = ["high", "emergency"].includes(analysis.urgency?.toLowerCase() || "");
  return (
    <aside className="mt-3 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/60 text-sm dark:border-sky-900/70 dark:bg-sky-950/20">
      <div className="flex items-center justify-between gap-3 border-b border-sky-100 px-4 py-3 dark:border-sky-900/70">
        <span className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <HeartPulse className="h-4 w-4 text-sky-500" />Educational guidance
        </span>
        {analysis.urgency && (
          <Badge className={urgencyClass(analysis.urgency)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {titleCase(analysis.urgency)} urgency
          </Badge>
        )}
      </div>
      <div className="space-y-3 p-4">
        {!!analysis.possible_conditions?.length && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Possible conditions</p>
            <div className="mt-2 space-y-1.5">
              {analysis.possible_conditions.map((condition, index) => (
                <div key={`${condition.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                  <span>{condition.name}</span>
                  {typeof condition.confidence === "number" && (
                    <span className="shrink-0 font-semibold text-sky-700 dark:text-sky-300">{Math.round(condition.confidence)}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {analysis.recommendation && (
          <div className="rounded-xl bg-white/80 p-3 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recommendation</p>
            <p className="mt-1 leading-5">{analysis.recommendation}</p>
          </div>
        )}
        {!!analysis.crisis_resources?.length && (
          <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 dark:border-rose-900/70 dark:bg-rose-950/30">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Immediate next steps</p>
            {analysis.crisis_resources.map((resource, index) => (
              <div key={`${resource.label}-${index}`} className="text-sm text-rose-950 dark:text-rose-50">
                <p className="font-semibold">{resource.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-rose-800 dark:text-rose-100">{resource.detail}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {resource.phone && (
                    <a href={`tel:${resource.phone}`} className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 underline underline-offset-2 dark:text-rose-200">
                      <Phone className="h-3 w-3" />Call {resource.phone}
                    </a>
                  )}
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 underline underline-offset-2 dark:text-rose-200">
                      Open resource <ArrowRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!!analysis.nearest_hospitals?.length && (
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <MapPinned className="h-3.5 w-3.5" />Nearest care
            </p>
            <div className="mt-1.5 space-y-1.5">
              {analysis.nearest_hospitals.slice(0, 3).map((hospital) => (
                <div key={hospital.id} className="rounded-xl bg-white/80 px-3 py-2 dark:bg-slate-900/70">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{hospital.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[hospital.type, hospital.distance_km != null ? `${hospital.distance_km} km` : null, hospital.address]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold">
                    {hospital.phone && (
                      <a href={`tel:${hospital.phone}`} className="text-sky-700 dark:text-sky-300">Call</a>
                    )}
                    {hospital.maps_url && (
                      <a href={hospital.maps_url} target="_blank" rel="noreferrer" className="text-sky-700 dark:text-sky-300">Map</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!!analysis.follow_up_questions?.length && (
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <CircleHelp className="h-3.5 w-3.5" />Helpful follow-ups
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {analysis.follow_up_questions.map((question, index) =>
                onFollowUp ? (
                  <button
                    key={`${question}-${index}`}
                    type="button"
                    onClick={() => onFollowUp(question)}
                    className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-sky-800 transition hover:border-sky-400 hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-200 dark:hover:border-sky-600"
                  >
                    {question}
                  </button>
                ) : (
                  <span key={`${question}-${index}`} className="inline-flex gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                    {question}
                  </span>
                ),
              )}
            </div>
          </div>
        )}
        {urgent && (
          <Link to="/hospitals" className="flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2.5 font-semibold text-white transition hover:bg-rose-700">
            <AlertTriangle className="h-4 w-4" />Find urgent care nearby
            <ArrowRight className="ml-auto h-4 w-4" />
          </Link>
        )}
        <p className="flex gap-1.5 border-t border-sky-100 pt-3 text-xs leading-4 text-slate-500 dark:border-sky-900/70 dark:text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          {analysis.disclaimer || "This is educational information, not a medical diagnosis. Seek professional care for symptoms that concern you."}
        </p>
      </div>
    </aside>
  );
}
''', encoding="utf-8")
print("OK HealthAnalysisCard")

(ROOT / "frontend/src/components/EmergencyAlert.tsx").write_text(r'''import { AlertTriangle, ExternalLink, Hospital, Phone, X } from "lucide-react";
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
  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-50"
          : "fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      }
      role="alertdialog"
      aria-modal={!compact}
      aria-labelledby="emergency-heading"
    >
      <div className={compact ? "" : "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900 dark:bg-slate-900 sm:p-8"}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Urgent safety notice</p>
                <h2 id="emergency-heading" className="mt-1 text-xl font-bold text-rose-950 dark:text-white">
                  Medical emergency detected
                </h2>
                {category && <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-200">{category}</p>}
              </div>
              {onClose && (
                <button onClick={onClose} aria-label="Close emergency notice" className="rounded-lg p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <p className="mt-3 text-sm leading-6 text-rose-800 dark:text-rose-100">
              Call local emergency services immediately or go to the nearest emergency department. Do not wait for an AI response.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a href={`tel:${emergencyNumber}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700">
            <Phone className="h-4 w-4" />Call {emergencyNumber}
          </a>
          <Link to="/hospitals" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-950 dark:text-rose-200">
            <Hospital className="h-4 w-4" />Find emergency care
          </Link>
        </div>
        {!!crisisResources?.length && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Crisis resources</p>
            {crisisResources.map((resource, index) => (
              <div key={`${resource.label}-${index}`} className="rounded-xl bg-rose-50 px-3 py-2 text-sm dark:bg-rose-950/40">
                <p className="font-semibold text-rose-950 dark:text-rose-50">{resource.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-rose-800 dark:text-rose-100">{resource.detail}</p>
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold">
                  {resource.phone && <a href={`tel:${resource.phone}`} className="text-rose-700 dark:text-rose-200">Call {resource.phone}</a>}
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-200">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!!nearestHospitals?.length && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Nearby facilities</p>
            {nearestHospitals.slice(0, 3).map((hospital) => (
              <div key={hospital.id} className="rounded-xl border border-rose-100 px-3 py-2 text-sm dark:border-rose-900/50">
                <p className="font-semibold text-slate-900 dark:text-white">{hospital.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[hospital.type, hospital.distance_km != null ? `${hospital.distance_km} km` : null].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-1.5 flex gap-3 text-xs font-bold text-rose-700 dark:text-rose-200">
                  {hospital.phone && <a href={`tel:${hospital.phone}`}>Call</a>}
                  {hospital.maps_url && (
                    <a href={hospital.maps_url} target="_blank" rel="noreferrer">Directions</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!compact && <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">MediAssist cannot provide emergency care or a diagnosis.</p>}
        {onClose && compact && <Button className="mt-3" variant="outline" onClick={onClose}>Dismiss</Button>}
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
''', encoding="utf-8")
print("OK EmergencyAlert")
