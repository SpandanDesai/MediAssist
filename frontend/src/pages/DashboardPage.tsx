import { useEffect, useState } from "react";
import { ArrowRight, BellRing, BotMessageSquare, FileText, HeartPulse, ImagePlus, MapPinned, Mic, Plus, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { EmergencyInlineNotice } from "../components/EmergencyAlert";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useAuth } from "../contexts/AuthContext";
import { assessmentApi, historyApi, remindersApi, statsApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { AssessmentResult, Conversation, HealthStats, Reminder } from "../types";

const careTools = [
  { to: "/chat", icon: BotMessageSquare, title: "Start a text consultation", copy: "Describe symptoms and get cautious next-step guidance.", tone: "bg-sky-500" },
  { to: "/voice", icon: Mic, title: "Talk it through", copy: "Record a voice consultation when typing is not ideal.", tone: "bg-violet-500" },
  { to: "/image-analysis", icon: ImagePlus, title: "Analyze an image", copy: "Share a visible skin or minor-wound concern safely.", tone: "bg-emerald-500" },
  { to: "/assessment", icon: ShieldCheck, title: "Lifestyle check-in", copy: "Score habits, track trend, and jump into a guided chat.", tone: "bg-amber-500" },
];

const healthTips = [
  { title: "Small changes count", copy: "A short walk, a glass of water, or a consistent bedtime can support your wellbeing." },
  { title: "Track what changes", copy: "For persistent symptoms, note when they started, what makes them better or worse, and your temperature if relevant." },
  { title: "Know your red flags", copy: "Sudden or severe symptoms need professional evaluation—use the nearby-care tool if you are unsure where to go." },
];

const statCards = [
  { key: "conversations", label: "Consultations", tone: "text-sky-600 dark:text-sky-300" },
  { key: "assessments", label: "Check-ins", tone: "text-amber-600 dark:text-amber-300" },
  { key: "reports", label: "Reports", tone: "text-emerald-600 dark:text-emerald-300" },
  { key: "images", label: "Images", tone: "text-violet-600 dark:text-violet-300" },
];

const urgencyMeta = [
  { key: "low", label: "Low", bar: "bg-emerald-500" },
  { key: "medium", label: "Medium", bar: "bg-amber-500" },
  { key: "high", label: "High", bar: "bg-orange-500" },
  { key: "emergency", label: "Emergency", bar: "bg-rose-600" },
];

function HealthTrends({ stats }: { stats: HealthStats }) {
  const trend = stats.assessment_trend.slice(-10);
  const maxScore = Math.max(1, ...trend.map((point) => point.risk_score));
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Your health at a glance</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aggregated from your recent activity. Educational only.</p>
        </div>
        <TrendingUp className="h-5 w-5 text-sky-500" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <p className={`text-2xl font-bold ${card.tone}`}>{stats.counts[card.key] ?? 0}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
            </div>
          ))}
        </div>
        {trend.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lifestyle risk trend</p>
            <div className="mt-3 flex items-end gap-1.5" aria-hidden="true">
              {trend.map((point, index) => (
                <div key={`${point.created_at}-${index}`} className="flex-1 rounded-t-md bg-gradient-to-t from-amber-400 to-amber-500" style={{ height: `${Math.max(8, (point.risk_score / maxScore) * 72)}px` }} title={`Score ${point.risk_score} · ${point.risk_level}`} />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Latest check-in scored {trend[trend.length - 1].risk_score} ({trend[trend.length - 1].risk_level}).</p>
          </div>
        )}
        {(() => {
          const entries = urgencyMeta.map((u) => ({ ...u, count: stats.urgency_distribution[u.key] ?? 0 }));
          const total = entries.reduce((sum, entry) => sum + entry.count, 0);
          if (total === 0) return null;
          return (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Urgency mix (recent conversations)</p>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                {entries.filter((entry) => entry.count > 0).map((entry) => (
                  <div key={entry.key} className={entry.bar} style={{ width: `${(entry.count / total) * 100}%` }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {entries.filter((entry) => entry.count > 0).map((entry) => (
                  <span key={entry.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className={`h-2 w-2 rounded-full ${entry.bar}`} />
                    {entry.label} · {entry.count}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
        {stats.recent_high_risk && stats.recent_high_risk.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">Needs attention</p>
            <ul className="mt-2 space-y-1.5">
              {stats.recent_high_risk.map((item) => (
                <li key={item.id}>
                  <Link to={`/chat?conversation=${encodeURIComponent(item.id)}`} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-sm transition hover:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/40">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">{item.title}</span>
                    <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold capitalize text-rose-700 dark:text-rose-300">{item.urgency}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<AssessmentResult | null>(null);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [upcoming, setUpcoming] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      historyApi.list().catch(() => [] as Conversation[]),
      assessmentApi.history().catch(() => [] as AssessmentResult[]),
      statsApi.get().catch(() => null),
      remindersApi.upcoming(7).catch(() => [] as Reminder[]),
    ]).then(([items, assessments, statsData, due]) => {
      if (!live) return;
      setRecent(items.slice(0, 4));
      setLatestAssessment(assessments[0] || null);
      setStats(statsData);
      setUpcoming(due);
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const name = user?.name?.split(" ")[0] || "there";
  return (
    <div className="space-y-6 animate-fade-up">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-sky-500 to-cyan-500 px-6 py-7 text-white shadow-lg shadow-sky-500/20 sm:px-8 sm:py-9"><div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" /><div className="relative max-w-2xl"><p className="text-sm font-medium text-sky-100">Welcome back, {name}</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">How can we support your health today?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-sky-50">Choose the way that feels easiest. MediAssist offers educational information and helps you decide when professional care is appropriate.</p><div className="mt-5 flex flex-wrap gap-3"><Link to="/chat" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-50"><Plus className="h-4 w-4" />New consultation</Link><Link to="/hospitals" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"><MapPinned className="h-4 w-4" />Find nearby care</Link></div></div></section>
      <EmergencyInlineNotice />
      {stats && <HealthTrends stats={stats} />}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Due soon</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Care reminders within the next 7 days.</p>
            </div>
            <Link to="/reminders" className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700">All reminders <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {upcoming.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"><BellRing className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>{item.due_at && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{displayDate(item.due_at)}</span>}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <section><div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[.14em] text-sky-600">Care tools</p><h2 className="mt-1 text-xl font-bold tracking-tight">Choose how you’d like to check in.</h2></div></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{careTools.map((tool) => <Link key={tool.to} to={tool.to} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-900"><div className="flex items-start justify-between gap-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm ${tool.tone}`}><tool.icon className="h-5 w-5" /></span><ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-500" /></div><h3 className="mt-5 font-bold text-slate-900 dark:text-white">{tool.title}</h3><p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{tool.copy}</p></Link>)}</div></section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><Card><CardHeader><div><p className="text-sm font-bold text-slate-900 dark:text-white">Recent conversations</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pick up where you left off or start fresh.</p></div><Link to="/chat" className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700">View all <ArrowRight className="h-3.5 w-3.5" /></Link></CardHeader><CardContent>{loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-[70px]" />)}</div> : recent.length > 0 ? <div className="space-y-2">{recent.map((conversation) => <Link key={conversation.id} to={`/chat?conversation=${encodeURIComponent(conversation.id)}`} className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"><BotMessageSquare className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{conversation.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{conversation.preview || "Continue this health conversation"}</span></span><span className="shrink-0 text-[11px] text-slate-400">{displayDate(conversation.updated_at)}</span></Link>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-9 text-center dark:border-slate-700"><BotMessageSquare className="mx-auto h-6 w-6 text-sky-500" /><p className="mt-3 text-sm font-semibold">No conversations yet</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">When you start a consultation, it will be saved here for easy follow-up.</p><Link to="/chat" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-sky-600">Start a consultation <ArrowRight className="h-3.5 w-3.5" /></Link></div>}</CardContent></Card><div className="space-y-6"><Card><CardHeader><div><p className="text-sm font-bold text-slate-900 dark:text-white">Today’s health tip</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">General wellbeing guidance</p></div><HeartPulse className="h-5 w-5 text-emerald-500" /></CardHeader><CardContent><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{healthTips[new Date().getDate() % healthTips.length].title}</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{healthTips[new Date().getDate() % healthTips.length].copy}</p></CardContent></Card>{latestAssessment ? (
          <Link to="/assessment" className="flex items-center gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-5 transition hover:border-amber-200 hover:bg-amber-100/60 dark:border-amber-900/70 dark:bg-amber-950/25 dark:hover:bg-amber-950/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-amber-950 dark:text-amber-100">Latest check-in · {latestAssessment.risk_score}</span>
              <span className="mt-1 block text-xs capitalize leading-5 text-amber-800 dark:text-amber-300">{latestAssessment.risk_level} lifestyle risk · {displayDate(latestAssessment.created_at)}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-amber-600" />
          </Link>
        ) : (
          <Link to="/assessment" className="flex items-center gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-5 transition hover:border-amber-200 hover:bg-amber-100/60 dark:border-amber-900/70 dark:bg-amber-950/25 dark:hover:bg-amber-950/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-amber-950 dark:text-amber-100">Take a lifestyle check-in</span>
              <span className="mt-1 block text-xs leading-5 text-amber-800 dark:text-amber-300">Get an educational risk score and actionable chat prompts.</span>
            </span>
            <ArrowRight className="h-4 w-4 text-amber-600" />
          </Link>
        )}
        <Link to="/reports" className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 transition hover:border-emerald-200 hover:bg-emerald-100/60 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white"><FileText className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-emerald-950 dark:text-emerald-100">Need a summary?</span><span className="mt-1 block text-xs leading-5 text-emerald-800 dark:text-emerald-300">Create a report from a consultation to share with a clinician.</span></span><ArrowRight className="h-4 w-4 text-emerald-600" /></Link></div></section>
      <section><div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-500" /><h2 className="text-lg font-bold">A gentle reminder</h2></div><div className="grid gap-4 md:grid-cols-3">{healthTips.map((tip, index) => <div key={tip.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><span className="text-xs font-bold text-sky-500">0{index + 1}</span><h3 className="mt-3 text-sm font-bold">{tip.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{tip.copy}</p></div>)}</div></section>
    </div>
  );
}
