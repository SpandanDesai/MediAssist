import { AlertTriangle, ArrowRight, CircleHelp, HeartPulse, MapPinned, Phone, ShieldCheck } from "lucide-react";
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
    <aside className="mt-3 overflow-hidden rounded-xl border border-rule bg-surface text-sm">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <span className="inline-flex items-center gap-2 font-semibold text-ink">
          <HeartPulse className="h-4 w-4 text-brand" />Educational guidance
        </span>
        {analysis.urgency && (
          <Badge className={urgencyClass(analysis.urgency)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {titleCase(analysis.urgency)} urgency
          </Badge>
        )}
      </div>
      <div className="space-y-4 p-4">
        {analysis.recommendation && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Recommendation</p>
            <p className="mt-1 leading-6 text-ink font-read">{analysis.recommendation}</p>
          </div>
        )}
        {!!analysis.possible_conditions?.length && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Possible conditions</p>
            <ul className="mt-1 divide-y divide-rule">
              {analysis.possible_conditions.map((condition, index) => (
                <li key={`${condition.name}-${index}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-ink font-read">{condition.name}</span>
                  {typeof condition.confidence === "number" ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-alt">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, condition.confidence))}%` }} />
                      </span>
                      <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink-2">{Math.round(condition.confidence)}%</span>
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-2">estimated</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!analysis.crisis_resources?.length && (
          <div className="rounded-xl border border-danger/30 bg-danger-tint p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-danger">Immediate next steps</p>
            <div className="mt-2 space-y-2">
              {analysis.crisis_resources.map((resource, index) => (
                <div key={`${resource.label}-${index}`} className="text-sm">
                  <p className="font-semibold text-ink">{resource.label}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{resource.detail}</p>
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    {resource.phone && <a href={`tel:${resource.phone}`} className="inline-flex items-center gap-1 text-[13px] font-bold text-danger underline underline-offset-2"><Phone className="h-3 w-3" />Call {resource.phone}</a>}
                    {resource.url && <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-bold text-danger underline underline-offset-2">Open resource <ArrowRight className="h-3 w-3" /></a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!!analysis.nearest_hospitals?.length && (
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-2"><MapPinned className="h-3.5 w-3.5" />Nearest care</p>
            <ul className="mt-1 divide-y divide-rule">
              {analysis.nearest_hospitals.slice(0, 3).map((hospital) => (
                <li key={hospital.id} className="py-2">
                  <p className="font-semibold text-ink">{hospital.name}</p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    {[hospital.type, hospital.distance_km != null ? `${hospital.distance_km} km` : null, hospital.address].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold text-brand">
                    {hospital.phone && <a href={`tel:${hospital.phone}`}>Call</a>}
                    {hospital.maps_url && <a href={hospital.maps_url} target="_blank" rel="noreferrer">Map</a>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!analysis.follow_up_questions?.length && (
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-2"><CircleHelp className="h-3.5 w-3.5" />Helpful follow-ups</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.follow_up_questions.map((question, index) =>
                onFollowUp ? (
                  <button key={`${question}-${index}`} type="button" onClick={() => onFollowUp(question)} className="rounded-full border border-rule bg-surface px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand">
                    {question}
                  </button>
                ) : (
                  <span key={`${question}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-surface-alt px-3 py-1.5 text-[13px] text-ink font-read"><ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand" />{question}</span>
                ),
              )}
            </div>
          </div>
        )}
        {urgent && (
          <Link to="/hospitals" className="flex items-center gap-2 rounded-lg bg-danger px-3 py-2.5 font-semibold text-danger-fg transition-opacity hover:opacity-90">
            <AlertTriangle className="h-4 w-4" />Find urgent care nearby
            <ArrowRight className="ml-auto h-4 w-4" />
          </Link>
        )}
        <p className="flex gap-1.5 border-t border-rule pt-3 text-[13px] leading-5 text-ink-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
          {analysis.disclaimer || "This is educational information, not a medical diagnosis. Seek professional care for symptoms that concern you."}
        </p>
      </div>
    </aside>
  );
}
