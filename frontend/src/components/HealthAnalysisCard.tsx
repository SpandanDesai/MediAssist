import { AlertTriangle, ArrowRight, CircleHelp, HeartPulse, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { HealthAnalysis } from "../types";
import { titleCase, urgencyClass } from "../lib/utils";
import { Badge } from "./ui/badge";

export function HealthAnalysisCard({ analysis }: { analysis?: HealthAnalysis }) {
  if (!analysis || (!analysis.possible_conditions?.length && !analysis.urgency && !analysis.recommendation && !analysis.follow_up_questions?.length)) return null;
  const urgent = ["high", "emergency"].includes(analysis.urgency?.toLowerCase() || "");
  return (
    <aside className="mt-3 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/60 text-sm dark:border-sky-900/70 dark:bg-sky-950/20">
      <div className="flex items-center justify-between gap-3 border-b border-sky-100 px-4 py-3 dark:border-sky-900/70"><span className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100"><HeartPulse className="h-4 w-4 text-sky-500" />Educational guidance</span>{analysis.urgency && <Badge className={urgencyClass(analysis.urgency)}><AlertTriangle className="h-3.5 w-3.5" />{titleCase(analysis.urgency)} urgency</Badge>}</div>
      <div className="space-y-3 p-4">
        {analysis.possible_conditions && analysis.possible_conditions.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Possible conditions</p><div className="mt-2 space-y-1.5">{analysis.possible_conditions.map((condition, index) => <div key={`${condition.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200"><span>{condition.name}</span>{typeof condition.confidence === "number" && <span className="shrink-0 font-semibold text-sky-700 dark:text-sky-300">{Math.round(condition.confidence)}%</span>}</div>)}</div></div>}
        {analysis.recommendation && <div className="rounded-xl bg-white/80 p-3 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recommendation</p><p className="mt-1 leading-5">{analysis.recommendation}</p></div>}
        {analysis.follow_up_questions && analysis.follow_up_questions.length > 0 && <div><p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><CircleHelp className="h-3.5 w-3.5" />Helpful follow-ups</p><ul className="mt-1.5 space-y-1 text-slate-700 dark:text-slate-200">{analysis.follow_up_questions.map((question, index) => <li key={`${question}-${index}`} className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />{question}</li>)}</ul></div>}
        {urgent && <Link to="/hospitals" className="flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2.5 font-semibold text-white transition hover:bg-rose-700"><AlertTriangle className="h-4 w-4" />Find urgent care nearby<ArrowRight className="ml-auto h-4 w-4" /></Link>}
        <p className="flex gap-1.5 border-t border-sky-100 pt-3 text-xs leading-4 text-slate-500 dark:border-sky-900/70 dark:text-slate-400"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />{analysis.disclaimer || "This is educational information, not a medical diagnosis. Seek professional care for symptoms that concern you."}</p>
      </div>
    </aside>
  );
}
