import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Label } from "../components/ui/form";
import { apiErrorMessage, assessmentApi } from "../lib/api";

const fields = [
  { key: "smoking", label: "Smoking", options: [["never", "Never"], ["former", "Former"], ["occasional", "Occasional"], ["daily", "Daily"]] },
  { key: "alcohol", label: "Alcohol", options: [["never", "Never"], ["rarely", "Rarely"], ["weekly", "Weekly"], ["daily", "Daily"]] },
  { key: "exercise", label: "Exercise", options: [["daily", "Daily"], ["weekly", "Weekly"], ["rarely", "Rarely"], ["never", "Never"]] },
  { key: "diet", label: "Diet", options: [["balanced", "Balanced"], ["mixed", "Mixed"], ["processed", "Mostly processed"], ["poor", "Poor"]] },
  { key: "sleep", label: "Sleep", options: [["7-9", "7–9 hours"], ["6", "About 6 hours"], ["under6", "Under 6 hours"], ["irregular", "Irregular"]] },
  { key: "stress", label: "Stress", options: [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["severe", "Severe"]] },
] as const;

type FormState = Record<(typeof fields)[number]["key"], string>;

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
  const [result, setResult] = useState<Awaited<ReturnType<typeof assessmentApi.run>> | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await assessmentApi.run(form);
      setResult(response);
      showToast({ tone: "success", title: "Assessment complete" });
    } catch (error) {
      showToast({ tone: "error", title: "Assessment failed", message: apiErrorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.1fr_.9fr] animate-fade-up">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Health risk check-in</p>
            <p className="mt-1 text-xs text-slate-500">Lifestyle questions only — educational risk framing, not a clinical diagnosis.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            {fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <select
                  id={field.key}
                  value={form[field.key]}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-950"
                >
                  {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Calculating…" : "Generate risk score"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Your results</p>
            <p className="mt-1 text-xs text-slate-500">Suggestions and preventive tips</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
        </CardHeader>
        <CardContent>
          {!result && <p className="py-12 text-center text-sm text-slate-500">Complete the check-in to see your educational risk score.</p>}
          {result && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-100">Risk score</p>
                <p className="mt-2 text-4xl font-bold">{result.risk_score}</p>
                <p className="mt-1 text-sm capitalize text-sky-50">{result.risk_level} lifestyle risk estimate</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Suggestions</p>
                <ul className="mt-2 space-y-2 text-sm leading-6">{result.suggestions.map((item) => <li key={item} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/40">{item}</li>)}</ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Preventive tips</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">{result.preventive_tips.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <p className="text-xs leading-5 text-slate-500">{result.disclaimer}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
