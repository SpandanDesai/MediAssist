import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useToast } from "./Toast";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input, Label, Select } from "./ui/form";
import { apiErrorMessage, mlDiabetesApi } from "../lib/api";
import type { DiabetesInput, DiabetesPredictionResult } from "../types";

// Encoded, dataset-specific inputs for the experimental CDC classifier. These
// are NOT raw user values: Age is a 1-13 band, GenHlth is 1 (excellent) to
// 5 (poor), and Sex/Education/Income are dataset codes. The example defaults
// below mirror the integration test payload and are illustrative only.
const EXAMPLE: DiabetesInput = {
  HighBP: 1, HighChol: 1, CholCheck: 1, BMI: 29, Smoker: 0, Stroke: 0,
  HeartDiseaseorAttack: 0, PhysActivity: 1, Fruits: 1, Veggies: 1,
  HvyAlcoholConsump: 0, AnyHealthcare: 1, NoDocbcCost: 0, GenHlth: 3,
  MentHlth: 2, PhysHlth: 3, DiffWalk: 0, Sex: 1, Age: 7, Education: 5, Income: 6,
};

const YES_NO: readonly (readonly [string, string])[] = [["0", "No"], ["1", "Yes"]];

const binaryFields: { key: keyof DiabetesInput; label: string }[] = [
  { key: "HighBP", label: "High blood pressure" },
  { key: "HighChol", label: "High cholesterol" },
  { key: "CholCheck", label: "Cholesterol checked (past 5 yrs)" },
  { key: "Smoker", label: "Currently smoke" },
  { key: "Stroke", label: "Ever had a stroke" },
  { key: "HeartDiseaseorAttack", label: "Heart disease or attack" },
  { key: "PhysActivity", label: "Physical activity (past month)" },
  { key: "Fruits", label: "Fruit consumption" },
  { key: "Veggies", label: "Vegetable consumption" },
  { key: "HvyAlcoholConsump", label: "Heavy alcohol use" },
  { key: "AnyHealthcare", label: "Has healthcare access" },
  { key: "NoDocbcCost", label: "Avoided doctor due to cost" },
  { key: "DiffWalk", label: "Difficulty walking" },
];

const encodedSelectFields: { key: keyof DiabetesInput; label: string; options: readonly (readonly [string, string])[] }[] = [
  { key: "Sex", label: "Sex (dataset code)", options: [["0", "0 · Female"], ["1", "1 · Male"]] },
  {
    key: "GenHlth", label: "General health (1 excellent → 5 poor)",
    options: [["1", "1 · Excellent"], ["2", "2 · Very good"], ["3", "3 · Good"], ["4", "4 · Fair"], ["5", "5 · Poor"]],
  },
  {
    key: "Age", label: "Age band (dataset code, not years)",
    options: [
      ["1", "1 · Under 18"], ["2", "2 · 18–24"], ["3", "3 · 25–29"], ["4", "4 · 30–34"], ["5", "5 · 35–39"],
      ["6", "6 · 40–44"], ["7", "7 · 45–49"], ["8", "8 · 50–54"], ["9", "9 · 55–59"], ["10", "10 · 60–64"],
      ["11", "11 · 65–69"], ["12", "12 · 70–74"], ["13", "13 · 75 or older"],
    ],
  },
];

const numberFields: { key: keyof DiabetesInput; label: string; min: number; max: number; hint: string }[] = [
  { key: "BMI", label: "BMI (integer)", min: 10, max: 100, hint: "Dataset-encoded integer." },
  { key: "MentHlth", label: "Poor mental health days (0–30)", min: 0, max: 30, hint: "Past month." },
  { key: "PhysHlth", label: "Poor physical health days (0–30)", min: 0, max: 30, hint: "Past month." },
  { key: "Education", label: "Education (code 1–6)", min: 1, max: 6, hint: "Dataset-coded level." },
  { key: "Income", label: "Income (code 1–8)", min: 1, max: 8, hint: "Dataset-coded band." },
];

export function DiabetesQuestionnaire() {
  const { showToast } = useToast();
  const [form, setForm] = useState<DiabetesInput>(EXAMPLE);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DiabetesPredictionResult | null>(null);

  function update(key: keyof DiabetesInput, value: string | number) {
    setForm((current) => ({ ...current, [key]: typeof value === "number" ? value : Number(value) }));
    setResult(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    try {
      setResult(await mlDiabetesApi.predict(form));
      showToast({ tone: "success", title: "Experimental estimate ready" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not run estimate", message: apiErrorMessage(error, "Please review the answers and try again.") });
    } finally {
      setPending(false);
    }
  }

  const positive = result?.prediction === 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Diabetes health questionnaire</p>
            <p className="mt-1 text-xs text-ink-2">Experimental classifier on a US population survey — separate from the obesity model and lifestyle check-in.</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-5 rounded-xl border border-rule bg-surface-alt p-3 text-xs leading-5 text-ink-2">
            Fields use the dataset&apos;s numeric encodings, not everyday values. Please answer each question truthfully rather than leaving blanks — for many of
            these features a <span className="font-semibold">0 means a specific &ldquo;No&rdquo;, not &ldquo;unknown&rdquo;</span>. This is an educational
            demonstration, not a screening tool, and no data is stored.
          </p>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            {binaryFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`dia-${field.key}`}>{field.label}</Label>
                <Select id={`dia-${field.key}`} value={String(form[field.key])} onChange={(event) => update(field.key, event.target.value)}>
                  {YES_NO.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </div>
            ))}
            {encodedSelectFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`dia-${field.key}`}>{field.label}</Label>
                <Select id={`dia-${field.key}`} value={String(form[field.key])} onChange={(event) => update(field.key, event.target.value)}>
                  {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </div>
            ))}
            {numberFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`dia-${field.key}`}>{field.label}</Label>
                <Input id={`dia-${field.key}`} type="number" min={field.min} max={field.max} step={1} required value={form[field.key]} onChange={(event) => update(field.key, Number(event.target.value))} />
                <p className="mt-1 text-[11px] text-ink-2">{field.hint}</p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Generating estimate…" : "Run diabetes estimate (experimental)"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Survey-label estimate</p>
            <p className="mt-1 text-xs text-ink-2">Model output and its limitations</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-brand" />
        </CardHeader>
        <CardContent>
          {!result && (
            <p className="py-12 text-center text-sm text-ink-2">Complete the questionnaire to see an experimental survey-label classification.</p>
          )}
          {result && (
            <div className="space-y-5">
              <div className="rounded-xl border border-rule bg-surface-alt p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Model output</p>
                <p className={`mt-2 text-xl font-bold ${positive ? "text-high" : "text-low"}`}>
                  {positive ? "Positive survey label" : "Negative survey label"}
                </p>
                <p className="mt-1 text-sm text-ink">{result.label}</p>
                <p className="mt-2 text-xs text-ink-2">{result.model} · decision threshold {result.decision_threshold}</p>
              </div>
              <div className="rounded-xl border border-rule p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">What this means</p>
                <p className="mt-2 text-sm leading-6 text-ink font-read">
                  The model estimates which label a survey respondent with these answers might receive, based on patterns in US population data. It does not
                  determine whether you currently have diabetes or prediabetes.
                </p>
                <p className="mt-3 text-sm leading-6 text-ink-2 font-read">
                  Model score for the positive label: <span className="tabular-nums font-semibold text-ink">{result.model_score.toFixed(3)}</span>. This is a raw
                  model score used to apply the threshold — it is <span className="font-semibold">not your personal probability or risk of diabetes</span>, and the
                  model may not generalize to people outside the survey population.
                </p>
              </div>
              <div className="rounded-xl border border-rule p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Recommended next step</p>
                <p className="mt-2 text-sm leading-6 text-ink font-read">
                  If you have concerns or risk factors, speak with a qualified healthcare professional. Diabetes screening and diagnosis require appropriate
                  clinical assessment and testing.
                </p>
              </div>
              <p className="text-[13px] leading-5 text-ink-2">{result.notice}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
