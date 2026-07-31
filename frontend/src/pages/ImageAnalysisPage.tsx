import { FormEvent, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { EmergencyAlert } from "../components/EmergencyAlert";
import { HealthAnalysisCard } from "../components/HealthAnalysisCard";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Textarea } from "../components/ui/form";
import { Skeleton } from "../components/ui/skeleton";
import { apiErrorMessage, imageApi } from "../lib/api";
import { isEmergencyText } from "../lib/utils";
import type { ImageAnalysis } from "../types";

export function ImageAnalysisPage() {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImageAnalysis | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  function onFileChange(selected: File | null) {
    setFile(selected);
    setResult(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      showToast({ tone: "info", title: "Choose a PNG or JPEG image first" });
      return;
    }
    if (notes && isEmergencyText(notes)) setEmergencyOpen(true);
    setPending(true);
    try {
      const analysis = await imageApi.analyze(file, notes.trim() || undefined);
      setResult(analysis);
      if (analysis.emergency) setEmergencyOpen(true);
      showToast({ tone: "success", title: "Image reviewed" });
    } catch (error) {
      showToast({ tone: "error", title: "Image analysis failed", message: apiErrorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2 animate-fade-up">
      {emergencyOpen && <EmergencyAlert onClose={() => setEmergencyOpen(false)} />}
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Medical image upload</p>
            <p className="mt-1 text-xs text-slate-500">PNG / JPG for skin, eye redness, swelling, or minor wounds. Never a confirmed diagnosis.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-sky-700">
              <ImagePlus className="h-8 w-8 text-sky-500" />
              <span className="mt-3 text-sm font-semibold">Drop an image or click to browse</span>
              <span className="mt-1 text-xs text-slate-500">Max 10 MB · PNG, JPG, JPEG</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
              />
            </label>
            {preview && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                <img src={preview} alt="Upload preview" className="max-h-72 w-full object-contain bg-slate-100 dark:bg-slate-950" />
              </div>
            )}
            <div>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes (duration, pain, itch, fever…)" />
            </div>
            <Button type="submit" disabled={pending || !file} className="w-full"><Upload className="h-4 w-4" />{pending ? "Analyzing…" : "Analyze image"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Vision analysis</p>
            <p className="mt-1 text-xs text-slate-500">Visible observations with uncertainty and next-step guidance</p>
          </div>
        </CardHeader>
        <CardContent>
          {pending && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>}
          {!pending && !result && <p className="py-16 text-center text-sm text-slate-500">Results will appear here after upload.</p>}
          {!pending && result && (
            <div className="space-y-4">
              <MarkdownMessage>{result.response}</MarkdownMessage>
              {result.description && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950/50">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-1 leading-6">{result.description}</p>
                </div>
              )}
              {!!result.visible_abnormalities?.length && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Visible abnormalities</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {result.visible_abnormalities.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}
              {result.severity && <p className="text-sm"><span className="font-semibold">Severity estimate:</span> {result.severity}</p>}
              {result.advice && <p className="text-sm"><span className="font-semibold">Advice:</span> {result.advice}</p>}
              <HealthAnalysisCard analysis={result} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
