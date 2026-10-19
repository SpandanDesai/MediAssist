import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input, Label, Select } from "../components/ui/form";
import { apiErrorMessage, assessmentApi, mlAssessmentApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { AssessmentResult, ObesityAllFeaturesInput, ObesityLifestyleInput, ObesityPredictionResult } from "../types";

const fields = [
  { key: "smoking", label: "Smoking", options: [["never", "Never"], ["former", "Former"], ["occasional", "Occasional"], ["daily", "Daily"]] },
  { key: "alcohol", label: "Alcohol", options: [["never", "Never"], ["rarely", "Rarely"], ["weekly", "Weekly"], ["daily", "Daily"]] },
  { key: "exercise", label: "Exercise", options: [["daily", "Daily"], ["weekly", "Weekly"], ["rarely", "Rarely"], ["never", "Never"]] },
  { key: "diet", label: "Diet", options: [["balanced", "Balanced"], ["mixed", "Mixed"], ["processed", "Mostly processed"], ["poor", "Poor"]] },
  { key: "sleep", label: "Sleep", options: [["7-9", "7–9 hours"], ["6", "About 6 hours"], ["under6", "Under 6 hours"], ["irregular", "Irregular"]] },
  { key: "stress", label: "Stress", options: [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["severe", "Severe"]] },
] as const;

type FormState = Record<(typeof fields)[number]["key"], string>;

type AssessmentMode = "rules" | "ml";
type ModelMode = "lifestyle" | "all-features";
type SelectOption = readonly [value: string, label: string];

const mlSelectOptions: Record<string, readonly SelectOption[]> = {
  Gender: [["Female", "Female"], ["Male", "Male"]],
  family_history_with_overweight: [["yes", "Yes"], ["no", "No"]],
  FAVC: [["yes", "Yes"], ["no", "No"]],
  CAEC: [["no", "Never"], ["Sometimes", "Sometimes"], ["Frequently", "Frequently"], ["Always", "Always"]],
  SMOKE: [["yes", "Yes"], ["no", "No"]],
  SCC: [["yes", "Yes"], ["no", "No"]],
  CALC: [["no", "Never"], ["Sometimes", "Sometimes"], ["Frequently", "Frequently"], ["Always", "Always"]],
  MTRANS: [["Automobile", "Automobile"], ["Motorbike", "Motorbike"], ["Bike", "Bike"], ["Public_Transportation", "Public transportation"], ["Walking", "Walking"]],
};

const predictionLabels: Record<string, string> = {
  Insufficient_Weight: "Underweight / insufficient weight",
  Normal_Weight: "Normal weight",
  Overweight_Level_I: "Overweight (Level I)",
  Overweight_Level_II: "Overweight (Level II)",
  Obesity_Type_I: "Obesity (Class I)",
  Obesity_Type_II: "Obesity (Class II)",
  Obesity_Type_III: "Obesity (Class III)",
};

const initialMLForm: ObesityAllFeaturesInput = {
  Gender: "Female",
  Age: 25,
  family_history_with_overweight: "yes",
  FAVC: "no",
  FCVC: 2,
  NCP: 3,
  CAEC: "Sometimes",
  SMOKE: "no",
  CH2O: 2,
  SCC: "no",
  FAF: 1,
  TUE: 1,
  CALC: "Sometimes",
  MTRANS: "Public_Transportation",
  Height: 1.7,
  Weight: 70,
};

function MLPicklist({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, optionLabel]) => <option key={option} value={option}>{optionLabel}</option>)}
      </Select>
    </div>
  );
}

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
  const [mode, setMode] = useState<AssessmentMode>("rules");
  const [modelMode, setModelMode] = useState<ModelMode>("lifestyle");
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
  const [mlForm, setMlForm] = useState<ObesityAllFeaturesInput>(initialMLForm);
  const [mlResult, setMlResult] = useState<ObesityPredictionResult | null>(null);
  const [mlPending, setMlPending] = useState(false);

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

  function updateMLForm<K extends keyof ObesityAllFeaturesInput>(key: K, value: ObesityAllFeaturesInput[K]) {
    setMlForm((current) => ({ ...current, [key]: value }));
    setMlResult(null);
  }

  async function submitML(event: FormEvent) {
    event.preventDefault();
    setMlPending(true);
    setMlResult(null);
    try {
      const prediction = modelMode === "all-features"
        ? await mlAssessmentApi.predictAllFeatures(mlForm)
        : await mlAssessmentApi.predictLifestyle({
            Gender: mlForm.Gender,
            Age: mlForm.Age,
            family_history_with_overweight: mlForm.family_history_with_overweight,
            FAVC: mlForm.FAVC,
            FCVC: mlForm.FCVC,
            NCP: mlForm.NCP,
            CAEC: mlForm.CAEC,
            SMOKE: mlForm.SMOKE,
            CH2O: mlForm.CH2O,
            SCC: mlForm.SCC,
            FAF: mlForm.FAF,
            TUE: mlForm.TUE,
            CALC: mlForm.CALC,
            MTRANS: mlForm.MTRANS,
          } satisfies ObesityLifestyleInput);
      setMlResult(prediction);
      showToast({ tone: "success", title: "Educational estimate ready" });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not generate estimate",
        message: apiErrorMessage(error, "Please check your answers and try again."),
      });
    } finally {
      setMlPending(false);
    }
  }

  const score = result?.risk_score ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div role="tablist" aria-label="Assessment type" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "rules"}
          onClick={() => setMode("rules")}
          className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${mode === "rules" ? "border-brand bg-brand-tint text-brand" : "border-rule bg-surface text-ink-2 hover:bg-surface-alt"}`}
        >
          Lifestyle risk check-in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "ml"}
          onClick={() => setMode("ml")}
          className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${mode === "ml" ? "border-brand bg-brand-tint text-brand" : "border-rule bg-surface text-ink-2 hover:bg-surface-alt"}`}
        >
          ML lifestyle classifier
        </button>
      </div>

      {mode === "rules" ? (
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
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
      ) : (
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-bold text-ink">Experimental ML classifier</p>
              <p className="mt-1 text-xs text-ink-2">A UCI dataset demonstration, separate from the lifestyle risk check-in.</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid gap-2 sm:grid-cols-2" aria-label="Choose model inputs">
              <button
                type="button"
                aria-pressed={modelMode === "lifestyle"}
                onClick={() => { setModelMode("lifestyle"); setMlResult(null); }}
                className={`rounded-xl border p-3 text-left transition-colors ${modelMode === "lifestyle" ? "border-brand bg-brand-tint" : "border-rule hover:bg-surface-alt"}`}
              >
                <span className="block text-sm font-semibold text-ink">Lifestyle only</span>
                <span className="mt-1 block text-xs text-ink-2">14 inputs; excludes height and weight.</span>
              </button>
              <button
                type="button"
                aria-pressed={modelMode === "all-features"}
                onClick={() => { setModelMode("all-features"); setMlResult(null); }}
                className={`rounded-xl border p-3 text-left transition-colors ${modelMode === "all-features" ? "border-brand bg-brand-tint" : "border-rule hover:bg-surface-alt"}`}
              >
                <span className="block text-sm font-semibold text-ink">All features</span>
                <span className="mt-1 block text-xs text-ink-2">16 inputs, including height and weight.</span>
              </button>
            </div>

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitML}>
              <MLPicklist id="ml-gender" label="Gender" value={mlForm.Gender} options={mlSelectOptions.Gender} onChange={(value) => updateMLForm("Gender", value as ObesityLifestyleInput["Gender"])} />
              <div>
                <Label htmlFor="ml-age">Age (years)</Label>
                <Input id="ml-age" type="number" min={10} max={120} step={1} required value={mlForm.Age} onChange={(event) => updateMLForm("Age", Number(event.target.value))} />
              </div>
              <MLPicklist id="ml-family-history" label="Family history of overweight" value={mlForm.family_history_with_overweight} options={mlSelectOptions.family_history_with_overweight} onChange={(value) => updateMLForm("family_history_with_overweight", value as ObesityLifestyleInput["family_history_with_overweight"])} />
              <MLPicklist id="ml-favc" label="Frequent high-calorie foods" value={mlForm.FAVC} options={mlSelectOptions.FAVC} onChange={(value) => updateMLForm("FAVC", value as ObesityLifestyleInput["FAVC"])} />
              <div>
                <Label htmlFor="ml-fcvc">Vegetable intake (1–3)</Label>
                <Input id="ml-fcvc" type="number" min={1} max={3} step={0.1} required value={mlForm.FCVC} onChange={(event) => updateMLForm("FCVC", Number(event.target.value))} />
              </div>
              <div>
                <Label htmlFor="ml-ncp">Main meals per day (1–4)</Label>
                <Input id="ml-ncp" type="number" min={1} max={4} step={0.1} required value={mlForm.NCP} onChange={(event) => updateMLForm("NCP", Number(event.target.value))} />
              </div>
              <MLPicklist id="ml-caec" label="Between-meal food" value={mlForm.CAEC} options={mlSelectOptions.CAEC} onChange={(value) => updateMLForm("CAEC", value as ObesityLifestyleInput["CAEC"])} />
              <MLPicklist id="ml-smoke" label="Smoking" value={mlForm.SMOKE} options={mlSelectOptions.SMOKE} onChange={(value) => updateMLForm("SMOKE", value as ObesityLifestyleInput["SMOKE"])} />
              <div>
                <Label htmlFor="ml-ch2o">Water intake (1–3)</Label>
                <Input id="ml-ch2o" type="number" min={1} max={3} step={0.1} required value={mlForm.CH2O} onChange={(event) => updateMLForm("CH2O", Number(event.target.value))} />
              </div>
              <MLPicklist id="ml-scc" label="Monitors calorie intake" value={mlForm.SCC} options={mlSelectOptions.SCC} onChange={(value) => updateMLForm("SCC", value as ObesityLifestyleInput["SCC"])} />
              <div>
                <Label htmlFor="ml-faf">Physical activity (0–3)</Label>
                <Input id="ml-faf" type="number" min={0} max={3} step={0.1} required value={mlForm.FAF} onChange={(event) => updateMLForm("FAF", Number(event.target.value))} />
              </div>
              <div>
                <Label htmlFor="ml-tue">Screen time (0–2)</Label>
                <Input id="ml-tue" type="number" min={0} max={2} step={0.1} required value={mlForm.TUE} onChange={(event) => updateMLForm("TUE", Number(event.target.value))} />
              </div>
              <MLPicklist id="ml-calc" label="Alcohol consumption" value={mlForm.CALC} options={mlSelectOptions.CALC} onChange={(value) => updateMLForm("CALC", value as ObesityLifestyleInput["CALC"])} />
              <MLPicklist id="ml-mtrans" label="Usual transportation" value={mlForm.MTRANS} options={mlSelectOptions.MTRANS} onChange={(value) => updateMLForm("MTRANS", value as ObesityLifestyleInput["MTRANS"])} />
              {modelMode === "all-features" && (
                <>
                  <div>
                    <Label htmlFor="ml-height">Height (meters)</Label>
                    <Input id="ml-height" type="number" min={0.8} max={2.5} step={0.01} required value={mlForm.Height} onChange={(event) => updateMLForm("Height", Number(event.target.value))} />
                  </div>
                  <div>
                    <Label htmlFor="ml-weight">Weight (kg)</Label>
                    <Input id="ml-weight" type="number" min={20} max={300} step={0.1} required value={mlForm.Weight} onChange={(event) => updateMLForm("Weight", Number(event.target.value))} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={mlPending} className="w-full sm:w-auto">
                  {mlPending ? "Generating estimate…" : "Run ML estimate"}
                </Button>
              </div>
            </form>
            <p className="mt-5 rounded-xl border border-rule bg-surface-alt p-3 text-xs leading-5 text-ink-2">
              This experimental model classifies patterns in a public dataset. It is for education only—not a diagnosis, clinical risk estimate, or individual prognosis. You can use the existing rules-based check-in for the separate lifestyle risk assessment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-bold text-ink">Classifier result</p>
              <p className="mt-1 text-xs text-ink-2">Model output and its limitations</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand" />
          </CardHeader>
          <CardContent>
            {!mlResult && (
              <p className="py-12 text-center text-sm text-ink-2">
                Complete the model inputs to see an experimental dataset classification.
              </p>
            )}
            {mlResult && (
              <div className="space-y-5">
                <div className="rounded-xl border border-rule bg-surface-alt p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Predicted category</p>
                  <p className="mt-2 text-xl font-bold text-ink">{predictionLabels[mlResult.predicted_category] || mlResult.category_label}</p>
                  <p className="mt-2 text-xs text-ink-2">
                    {mlResult.model === "obesity_all_features" ? "All-features model" : "Lifestyle-only model"}
                  </p>
                </div>
                {!!mlResult.class_probabilities && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Model class probabilities</p>
                    <ul className="mt-3 space-y-3">
                      {Object.entries(mlResult.class_probabilities)
                        .sort(([, first], [, second]) => second - first)
                        .map(([category, probability]) => (
                          <li key={category}>
                            <div className="mb-1 flex justify-between gap-3 text-xs">
                              <span className="text-ink">{predictionLabels[category] || category}</span>
                              <span className="shrink-0 tabular-nums text-ink-2">{(probability * 100).toFixed(1)}%</span>
                            </div>
                            <div
                              className="h-2 overflow-hidden rounded-full bg-surface-alt"
                              role="meter"
                              aria-label={`${predictionLabels[category] || category} probability`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(probability * 1000) / 10}
                            >
                              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, probability * 100))}%` }} />
                            </div>
                          </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs leading-5 text-ink-2">Probabilities describe this model’s output, not a person’s medical risk.</p>
                  </div>
                )}
                {!!mlResult.recommendations.length && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">General habit reflections</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-ink font-read">
                      {mlResult.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-[13px] leading-5 text-ink-2">{mlResult.disclaimer}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
