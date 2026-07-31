import { useEffect, useState } from "react";
import { ArrowRight, BotMessageSquare, FileText, HeartPulse, ImagePlus, MapPinned, Mic, Plus, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { EmergencyInlineNotice } from "../components/EmergencyAlert";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useAuth } from "../contexts/AuthContext";
import { historyApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { Conversation } from "../types";

const careTools = [
  { to: "/chat", icon: BotMessageSquare, title: "Start a text consultation", copy: "Describe symptoms and get cautious next-step guidance.", tone: "bg-sky-500" },
  { to: "/voice", icon: Mic, title: "Talk it through", copy: "Record a voice consultation when typing is not ideal.", tone: "bg-violet-500" },
  { to: "/image-analysis", icon: ImagePlus, title: "Analyze an image", copy: "Share a visible skin or minor-wound concern safely.", tone: "bg-emerald-500" },
];

const healthTips = [
  { title: "Small changes count", copy: "A short walk, a glass of water, or a consistent bedtime can support your wellbeing." },
  { title: "Track what changes", copy: "For persistent symptoms, note when they started, what makes them better or worse, and your temperature if relevant." },
  { title: "Know your red flags", copy: "Sudden or severe symptoms need professional evaluation—use the nearby-care tool if you are unsure where to go." },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    historyApi.list().then((items) => { if (live) setRecent(items.slice(0, 4)); }).catch(() => { if (live) setRecent([]); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const name = user?.name?.split(" ")[0] || "there";
  return (
    <div className="space-y-6 animate-fade-up">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-sky-500 to-cyan-500 px-6 py-7 text-white shadow-lg shadow-sky-500/20 sm:px-8 sm:py-9"><div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" /><div className="relative max-w-2xl"><p className="text-sm font-medium text-sky-100">Welcome back, {name}</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">How can we support your health today?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-sky-50">Choose the way that feels easiest. MediAssist offers educational information and helps you decide when professional care is appropriate.</p><div className="mt-5 flex flex-wrap gap-3"><Link to="/chat" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50"><Plus className="h-4 w-4" />New consultation</Link><Link to="/hospitals" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"><MapPinned className="h-4 w-4" />Find nearby care</Link></div></div></section>
      <EmergencyInlineNotice />
      <section><div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[.14em] text-sky-600">Care tools</p><h2 className="mt-1 text-xl font-bold tracking-tight">Choose how you’d like to check in.</h2></div></div><div className="grid gap-4 lg:grid-cols-3">{careTools.map((tool) => <Link key={tool.to} to={tool.to} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-900"><div className="flex items-start justify-between gap-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm ${tool.tone}`}><tool.icon className="h-5 w-5" /></span><ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-500" /></div><h3 className="mt-5 font-bold text-slate-900 dark:text-white">{tool.title}</h3><p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{tool.copy}</p></Link>)}</div></section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><Card><CardHeader><div><p className="text-sm font-bold text-slate-900 dark:text-white">Recent conversations</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pick up where you left off or start fresh.</p></div><Link to="/chat" className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700">View all <ArrowRight className="h-3.5 w-3.5" /></Link></CardHeader><CardContent>{loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-[70px]" />)}</div> : recent.length > 0 ? <div className="space-y-2">{recent.map((conversation) => <Link key={conversation.id} to={`/chat?conversation=${encodeURIComponent(conversation.id)}`} className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"><BotMessageSquare className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{conversation.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{conversation.preview || "Continue this health conversation"}</span></span><span className="shrink-0 text-[11px] text-slate-400">{displayDate(conversation.updated_at)}</span></Link>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-9 text-center dark:border-slate-700"><BotMessageSquare className="mx-auto h-6 w-6 text-sky-500" /><p className="mt-3 text-sm font-semibold">No conversations yet</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">When you start a consultation, it will be saved here for easy follow-up.</p><Link to="/chat" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-sky-600">Start a consultation <ArrowRight className="h-3.5 w-3.5" /></Link></div>}</CardContent></Card><div className="space-y-6"><Card><CardHeader><div><p className="text-sm font-bold text-slate-900 dark:text-white">Today’s health tip</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">General wellbeing guidance</p></div><HeartPulse className="h-5 w-5 text-emerald-500" /></CardHeader><CardContent><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{healthTips[new Date().getDate() % healthTips.length].title}</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{healthTips[new Date().getDate() % healthTips.length].copy}</p></CardContent></Card><Link to="/reports" className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 transition hover:border-emerald-200 hover:bg-emerald-100/60 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white"><FileText className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-emerald-950 dark:text-emerald-100">Need a summary?</span><span className="mt-1 block text-xs leading-5 text-emerald-800 dark:text-emerald-300">Create a report from a consultation to share with a clinician.</span></span><ArrowRight className="h-4 w-4 text-emerald-600" /></Link></div></section>
      <section><div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-500" /><h2 className="text-lg font-bold">A gentle reminder</h2></div><div className="grid gap-4 md:grid-cols-3">{healthTips.map((tip, index) => <div key={tip.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><span className="text-xs font-bold text-sky-500">0{index + 1}</span><h3 className="mt-3 text-sm font-bold">{tip.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{tip.copy}</p></div>)}</div></section>
    </div>
  );
}
