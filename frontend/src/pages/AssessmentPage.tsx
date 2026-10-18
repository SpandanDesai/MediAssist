import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Label, Select } from "../components/ui/form";
import { apiErrorMessage, assessmentApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { AssessmentResult } from "../types";

const fields = [
  { key: "smoking", label: "Smoking", options: [["never", "Never"], ["former", "Former"], ["occasional", "Occasional"], ["daily", "Daily"]] },
  { key: "alcohol", label: "Alcohol", options: [["never", "Never"], ["rarely", "Rarely"], ["weekly", "Weekly"], ["daily", "Daily"]] },
  { key: "exercise", label: "Exercise", options: [["daily", "Daily"], ["weekly", "Weekly"], ["rarely", "Rarely"], ["never", "Never"]] },
  { key: "diet", label: "Diet", options: [["balanced", "Balanced"], ["mixed", "Mixed"], ["processed", "Mostly processed"], ["poor", "Poor"]] },
  { key: "sleep", label: "Sleep", options: [["7-9", "7–9 hours"], ["6", "About 6 hours"], ["under6", "Under 6 hours"], ["irregular", "Irregular"]] },
  { key: "stress", label: "Stress", options: [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["severe", "Severe"]] },
] as const;

type FormState = Record<(typeof fields)[number]["key"], string>;

function bandClass(level: string) {
  switch (level?.toLowerCase()) {
    case "high": return "text-emergency";
    case "elevated": return "text-high";
    case "moderate": return "text-med";
    default: return "text-low";
  }
}

export function AssessmentPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>({
    smoking: "never",
    alcohol: "rarely",
    exercise: "weekly",
    diet: "mixed",
    sleep: "7-9",
    stress: "moderate",
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [history, setHistory] = useState<AssessmentResult[]>([]);

  useEffect(() => {
    let live = true;
    assessmentApi
      .history()
      .then((items) => {
        if (!live) return;
        setHistory(items);
        if (items[0]) setResult(items[0]);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await assessmentApi.run(form);
      setResult(response);
      setHistory((current) => [response, ...current].slice(0, 12));
      showToast({ tone: "success", title: "Assessment saved" });
    } catch (error) {
      showToast({ tone: "error", title: "Assessment failed", message: apiErrorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  const score = result?.risk_score ?? 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Health risk check-in</p>
            <p className="mt-1 text-xs text-ink-2">Lifestyle questions only — educational risk framing, not a clinical diagnosis.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            {fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Select id={field.key} value={form[field.key]} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}>
                  {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Calculating…" : "Generate risk score"}</Button>
            </div>
          </form>
          {history.length > 1 && (
            <div className="mt-6 border-t border-rule pt-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Recent check-ins</p>
              <ul className="mt-2 divide-y divide-rule">
                {history.slice(0, 5).map((item) => (
                  <li key={item.id || item.created_at}>
                    <button type="button" onClick={() => setResult(item)} className="flex w-full items-center justify-between py-2.5 text-left text-sm transition-colors hover:text-brand">
                      <span className="font-semibold capitalize text-ink">{item.risk_level} · {item.risk_score}</span>
                      <span className="text-xs text-ink-2">{displayDate(item.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Your results</p>
            <p className="mt-1 text-xs text-ink-2">Suggestions and next actions</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-brand" />
        </CardHeader>
        <CardContent>
          {!result && <p className="py-12 text-center text-sm text-ink-2">Complete the check-in to see your educational risk score.</p>}
          {result && (
            <div className="space-y-5">
              <div className="rounded-xl border border-rule bg-surface-alt p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-4xl font-bold tabular-nums text-ink">{result.risk_score}</p>
                    <p className={`mt-1 text-sm font-semibold capitalize ${bandClass(result.risk_level)}`}>{result.risk_level} lifestyle risk</p>
                  </div>
                  <p className="text-right text-xs text-ink-2">Calculated<br />{displayDate(result.created_at)}</p>
                </div>
                <div className="mt-4">
                  <div className="relative h-2 w-full overflow-hidden rounded-full">
                    <div className="absolute inset-y-0 left-0 bg-low" style={{ width: "30%" }} />
                    <div className="absolute inset-y-0 bg-med" style={{ left: "30%", width: "25%" }} />
                    <div className="absolute inset-y-0 bg-high" style={{ left: "55%", width: "20%" }} />
                    <div className="absolute inset-y-0 bg-emergency" style={{ left: "75%", width: "25%" }} />
                    <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 bg-ink" style={{ left: `${Math.min(100, Math.max(0, score))}%` }} aria-hidden="true" />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-ink-2"><span>0</span><span>30</span><span>55</span><span>75</span><span>100</span></div>
                  <p className="mt-2 text-[13px] text-ink-2 font-read">Lower is better · educational estimate, not a diagnosis.</p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Suggestions</p>
                <ul className="mt-1 divide-y divide-rule text-sm">{result.suggestions.map((item) => <li key={item} className="py-2.5 leading-6 text-ink font-read">{item}</li>)}</ul>
              </div>
              {!!result.chat_prompts?.length && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Talk it through</p>
                  <div className="mt-2 space-y-2">
                    {result.chat_prompts.map((prompt) => (
                      <Link key={prompt} to={`/chat?prompt=${encodeURIComponent(prompt)}`} className="flex items-start gap-2 rounded-lg border border-rule bg-surface px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand">
                        <span className="min-w-0 flex-1">{prompt}</span>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Preventive tips</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-ink font-read">{result.preventive_tips.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <p className="text-[13px] leading-5 text-ink-2">{result.disclaimer}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
