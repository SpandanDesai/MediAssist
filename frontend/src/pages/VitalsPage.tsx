import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, Plus, Trash2 } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input, Label, Select, Textarea } from "../components/ui/form";
import { Skeleton } from "../components/ui/skeleton";
import { apiErrorMessage, vitalsApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { Vital, VitalKind } from "../types";

const VITAL_META: Record<VitalKind, { label: string; unit: string; step: string; placeholder: string }> = {
  weight_kg: { label: "Weight", unit: "kg", step: "0.1", placeholder: "e.g. 72.5" },
  height_cm: { label: "Height", unit: "cm", step: "0.1", placeholder: "e.g. 175" },
  systolic_bp: { label: "Systolic BP", unit: "mmHg", step: "1", placeholder: "e.g. 120" },
  diastolic_bp: { label: "Diastolic BP", unit: "mmHg", step: "1", placeholder: "e.g. 80" },
  resting_hr: { label: "Resting heart rate", unit: "bpm", step: "1", placeholder: "e.g. 62" },
  temperature_c: { label: "Temperature", unit: "\u00b0C", step: "0.1", placeholder: "e.g. 36.8" },
  spo2_pct: { label: "Oxygen saturation", unit: "%", step: "0.1", placeholder: "e.g. 98" },
  glucose_mgdl: { label: "Blood glucose", unit: "mg/dL", step: "1", placeholder: "e.g. 95" },
  bmi: { label: "BMI", unit: "kg/m\u00b2", step: "0.1", placeholder: "e.g. 24.1" },
};

const KIND_ORDER = Object.keys(VITAL_META) as VitalKind[];

function TrendChart({ points, unit }: { points: Vital[]; unit: string }) {
  // Chronological oldest → newest, capped to the most recent 12 readings.
  const series = [...points].reverse().slice(-12);
  if (series.length < 2) {
    return (
      <p className="rounded-xl border border-rule bg-surface-alt p-4 text-sm text-ink-2 font-read">
        Log at least two readings for this measure to see a trend.
      </p>
    );
  }
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const latest = series[series.length - 1];
  const first = series[0];
  const delta = latest.value - first.value;
  return (
    <figure>
      <div className="relative flex h-40 items-end gap-2">
        {series.map((point, index) => {
          const heightPct = 12 + ((point.value - min) / span) * 80;
          const isLast = index === series.length - 1;
          return (
            <div key={`${point.id}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[11px] font-semibold tabular-nums text-ink-2">{point.value}</span>
              <div
                className={`w-full max-w-[34px] rounded-t ${isLast ? "bg-brand" : "bg-brand/60"}`}
                style={{ height: `${heightPct}%` }}
                title={`${point.value} ${point.unit} · ${displayDate(point.recorded_at)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 text-[10px] text-ink-2">
        {series.map((point, index) => (
          <span key={index} className="flex-1 truncate text-center">{new Date(point.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        ))}
      </div>
      <figcaption className="mt-3 text-[13px] text-ink-2">
        Latest <span className="font-semibold tabular-nums text-ink">{latest.value} {unit}</span> · change since first{" "}
        <span className="font-semibold tabular-nums text-ink">{delta > 0 ? "+" : ""}{Number(delta.toFixed(2))} {unit}</span>
      </figcaption>
    </figure>
  );
}

export function VitalsPage() {
  const { showToast } = useToast();
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewKind, setViewKind] = useState<VitalKind>("weight_kg");
  const [addKind, setAddKind] = useState<VitalKind>("weight_kg");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const items = await vitalsApi.list();
    setVitals(items);
  }

  useEffect(() => {
    let live = true;
    vitalsApi
      .list()
      .then((items) => { if (live) setVitals(items); })
      .catch(() => { if (live) setVitals([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast({ tone: "error", title: "Enter a positive number" });
      return;
    }
    setSaving(true);
    try {
      await vitalsApi.create({ kind: addKind, value: parsed, note: note.trim() || undefined, recorded_at: recordedAt || undefined });
      await refresh();
      setValue("");
      setNote("");
      setRecordedAt("");
      setViewKind(addKind);
      showToast({ tone: "success", title: "Reading saved" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not save reading", message: apiErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await vitalsApi.remove(id);
      setVitals((current) => current.filter((item) => item.id !== id));
      showToast({ tone: "success", title: "Reading removed" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not remove reading", message: apiErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  const scoped = useMemo(() => vitals.filter((item) => item.kind === viewKind), [vitals, viewKind]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Vitals tracker</p>
            <p className="mt-1 text-xs text-ink-2">Log everyday measurements to watch a trend. Educational only — never a diagnosis.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vital-kind">Measure</Label>
              <Select id="vital-kind" value={addKind} onChange={(event) => setAddKind(event.target.value as VitalKind)}>
                {KIND_ORDER.map((kind) => (
                  <option key={kind} value={kind}>{VITAL_META[kind].label} ({VITAL_META[kind].unit})</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="vital-value">Value ({VITAL_META[addKind].unit})</Label>
              <Input id="vital-value" type="number" inputMode="decimal" step={VITAL_META[addKind].step} min="0" value={value} onChange={(event) => setValue(event.target.value)} placeholder={VITAL_META[addKind].placeholder} required />
            </div>
            <div>
              <Label htmlFor="vital-date">Date (optional)</Label>
              <Input id="vital-date" type="date" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving || !value.trim()} className="w-full"><Plus className="h-4 w-4" />{saving ? "Saving…" : "Add reading"}</Button>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="vital-note">Note (optional)</Label>
              <Textarea id="vital-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything to remember — fasting, post-meal, etc." maxLength={500} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Trend</p>
            <p className="mt-1 text-xs text-ink-2">Most recent readings for the selected measure.</p>
          </div>
          <Select aria-label="Select measure to chart" value={viewKind} onChange={(event) => setViewKind(event.target.value as VitalKind)} className="w-auto min-w-40">
            {KIND_ORDER.map((kind) => (
              <option key={kind} value={kind}>{VITAL_META[kind].label}</option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40" />
          ) : (
            <TrendChart points={scoped} unit={VITAL_META[viewKind].unit} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">All readings</p>
            <p className="mt-1 text-xs text-ink-2">{vitals.length} stored · private to your account.</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
          ) : vitals.length === 0 ? (
            <div className="py-8 text-center">
              <Activity className="mx-auto h-6 w-6 text-ink-2" />
              <p className="mt-3 text-sm font-semibold text-ink">No readings yet</p>
              <p className="mt-1 text-xs text-ink-2">Add a measurement above to start tracking your trend.</p>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {vitals.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand"><Activity className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{VITAL_META[item.kind]?.label || item.kind} · <span className="tabular-nums">{item.value} {item.unit}</span></p>
                    <p className="truncate text-[11px] text-ink-2">{displayDate(item.recorded_at)}{item.note ? ` · ${item.note}` : ""}</p>
                  </div>
                  <button onClick={() => remove(item.id)} disabled={busyId === item.id} className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-danger-tint hover:text-danger" aria-label="Delete reading">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
