import { ArrowLeft, HeartPulse, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="mx-auto flex h-20 max-w-4xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2 font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white"><HeartPulse className="h-4 w-4" /></span>MediAssist AI</Link>
        <Link to="/signup"><Button size="sm">Get started</Button></Link>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-sky-600"><ArrowLeft className="h-4 w-4" />Back</Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">About MediAssist AI</h1>
        <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
          MediAssist AI is a multimodal healthcare-information assistant. It helps people describe symptoms through text or voice,
          review visible concerns with image analysis, find nearby care, and generate educational summaries—while staying clear
          that it is not a clinician and never provides a confirmed diagnosis.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            "Ask follow-up questions before narrowing educational possibilities",
            "Estimate possible conditions with confidence percentages",
            "Escalate emergency language to immediate care guidance",
            "Keep medical history optional and under user control",
          ].map((item) => (
            <Card key={item} className="p-5"><CardContent className="flex gap-3 p-0 text-sm leading-6"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{item}</CardContent></Card>
          ))}
        </div>
        <p className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          Important: MediAssist AI is for informational purposes only. It does not replace professional medical advice, diagnosis, or treatment.
          If you think you may be experiencing a medical emergency, call local emergency services immediately.
        </p>
      </main>
    </div>
  );
}
