import { useEffect, useState } from "react";
import { ArrowRight, BellRing, BotMessageSquare, FileText, HeartPulse, ImagePlus, MapPinned, Mic, Plus, ShieldCheck, TrendingUp, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { EmergencyInlineNotice } from "../components/EmergencyAlert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useAuth } from "../contexts/AuthContext";
import { assessmentApi, historyApi, remindersApi, statsApi, vitalsApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { AssessmentResult, Conversation, HealthStats, Reminder, Vital } from "../types";

const careTools = [
  { to: "/chat", icon: BotMessageSquare, title: "Start a text consultation", copy: "Describe symptoms and get cautious next-step guidance." },
  { to: "/voice", icon: Mic, title: "Talk it through", copy: "Record a voice consultation when typing is not ideal." },
  { to: "/image-analysis", icon: ImagePlus, title: "Analyze an image", copy: "Share a visible skin or minor-wound concern safely." },
  { to: "/assessment", icon: ShieldCheck, title: "Health check-in", copy: "Score habits, track trend, and jump into a guided chat." },
  { to: "/vitals", icon: Activity, title: "Track your vitals", copy: "Log weight, blood pressure, glucose, and more to watch a trend." },
];

const healthTips = [
  { title: "Small changes count", copy: "A short walk, a glass of water, or a consistent bedtime can support your wellbeing." },
  { title: "Track what changes", copy: "For persistent symptoms, note when they started, what makes them better or worse, and your temperature if relevant." },
  { title: "Know your red flags", copy: "Sudden or severe symptoms need professional evaluation—use the nearby-care tool if you are unsure where to go." },
];

const stats = [
  { key: "conversations", label: "Consultations" },
  { key: "assessments", label: "Check-ins" },
  { key: "reports", label: "Reports" },
  { key: "images", label: "Images" },
] as const;

const urgencyMeta = [
  { key: "low", label: "Low", dot: "bg-low", bar: "bg-low" },
  { key: "medium", label: "Medium", dot: "bg-med", bar: "bg-med" },
  { key: "high", label: "High", dot: "bg-high", bar: "bg-high" },
  { key: "emergency", label: "Emergency", dot: "bg-emergency", bar: "bg-emergency" },
] as const;

function riskBarClass(level: string) {
  switch (level?.toLowerCase()) {
    case "high": return "bg-emergency";
    case "elevated": return "bg-high";
    case "moderate": return "bg-med";
    default: return "bg-brand";
  }
}

function RiskTrend({ points }: { points: { created_at: string; risk_score: number; risk_level: string }[] }) {
  if (points.length === 0) return null;
  const latest = points[points.length - 1];
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-rule bg-surface-alt p-4">
        <p className="text-sm text-ink font-read">Latest check-in scored <span className="font-bold tabular-nums text-ink">{latest.risk_score}</span> ({latest.risk_level}). Not enough check-ins yet to show a trend.</p>
      </div>
    );
  }
  return (
    <figure>
      <div className="flex gap-3">
        <div className="flex w-7 shrink-0 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-ink-2" aria-hidden="true">
          <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="border-t border-rule" />)}
          </div>
          <div className="relative flex h-40 items-end gap-2 sm:gap-3">
            {points.map((point, index) => {
              const isLast = index === points.length - 1;
              return (
                <div key={`${point.created_at}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-[11px] font-semibold tabular-nums text-ink-2">{point.risk_score}</span>
                  <div className={`w-full max-w-[34px] rounded-t ${isLast ? riskBarClass(point.risk_level) : "bg-brand/70"}`} style={{ height: `${Math.max(4, point.risk_score)}%` }} title={`Score ${point.risk_score} · ${point.risk_level}`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2 pl-10 text-[10px] text-ink-2 sm:gap-3">
        {points.map((point, index) => <span key={index} className="flex-1 truncate text-center">{new Date(point.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>)}
      </div>
      <figcaption className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
        <span className={`h-2 w-2 rounded-full ${riskBarClass(latest.risk_level)}`} />
        Latest scored <span className="font-semibold tabular-nums text-ink">{latest.risk_score}</span> ({latest.risk_level}){points.length > 1 && <> · from {points[0].risk_score}</>}
      </figcaption>
    </figure>
  );
}

function HealthTrends({ stats: data }: { stats: HealthStats }) {
  const trend = data.assessment_trend.slice(-10);
  const urgencyEntries = urgencyMeta.map((u) => ({ ...u, count: data.urgency_distribution[u.key] ?? 0 }));
  const urgencyTotal = urgencyEntries.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-sm font-bold text-ink">Your health at a glance</p>
          <p className="mt-1 text-xs text-ink-2">Aggregated from your recent activity. Educational only.</p>
        </div>
        <TrendingUp className="h-5 w-5 text-brand" />
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid grid-cols-2 divide-rule sm:grid-cols-4 sm:divide-x">
          {stats.map((stat) => (
            <div key={stat.key} className="px-1 py-2 sm:px-4 first:pl-0">
              <dd className="text-2xl font-bold tabular-nums text-ink">{data.counts[stat.key] ?? 0}</dd>
              <dt className="mt-0.5 text-xs font-medium text-ink-2">{stat.label}</dt>
            </div>
          ))}
        </dl>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-2">Lifestyle risk · 0–100 (lower is better)</p>
            <RiskTrend points={trend} />
          </div>
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-2">Recent conversation urgency</p>
            {urgencyTotal === 0 ? (
              <p className="text-sm text-ink-2 font-read">No urgency flagged yet.</p>
            ) : (
              <>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
                  {urgencyEntries.filter((e) => e.count > 0).map((e) => <div key={e.key} className={e.bar} style={{ width: `${(e.count / urgencyTotal) * 100}%` }} />)}
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {urgencyEntries.map((e) => (
                    <li key={e.key} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-ink-2"><span className={`h-2 w-2 rounded-full ${e.dot}`} />{e.label}</span>
                      <span className="font-semibold tabular-nums text-ink">{e.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {data.recent_high_risk && data.recent_high_risk.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">Needs attention</p>
            <ul className="divide-y divide-rule rounded-xl border border-rule">
              {data.recent_high_risk.map((item) => (
                <li key={item.id}>
                  <Link to={`/chat?conversation=${encodeURIComponent(item.id)}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-alt">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{item.title}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${item.urgency === "emergency" ? "bg-emergency-tint text-emergency" : "bg-high-tint text-high"}`}>{item.urgency}</span>
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

const vitalLabels: Record<string, string> = {
  weight_kg: "Weight", height_cm: "Height", systolic_bp: "Systolic BP", diastolic_bp: "Diastolic BP",
  resting_hr: "Resting HR", temperature_c: "Temperature", spo2_pct: "Oxygen", glucose_mgdl: "Glucose", bmi: "BMI",
};

function VitalsSnapshot({ vitals }: { vitals: Vital[] }) {
  // Most recent reading per kind, newest-first list deduplicated by kind.
  const latestByKind = new Map<string, Vital>();
  for (const vital of vitals) {
    if (!latestByKind.has(vital.kind)) latestByKind.set(vital.kind, vital);
  }
  const entries = [...latestByKind.values()];
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-sm font-bold text-ink">Latest vitals</p>
          <p className="mt-1 text-xs text-ink-2">Your most recent logged readings.</p>
        </div>
        <Link to="/vitals" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-strong">Track <ArrowRight className="h-3.5 w-3.5" /></Link>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {entries.map((vital) => (
            <div key={vital.kind} className="rounded-xl border border-rule bg-surface-alt px-3.5 py-3">
              <dt className="text-[11px] font-medium text-ink-2">{vitalLabels[vital.kind] || vital.kind}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{vital.value}<span className="ml-1 text-xs font-medium text-ink-2">{vital.unit}</span></dd>
              <dd className="mt-0.5 text-[11px] text-ink-2">{displayDate(vital.recorded_at)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<AssessmentResult | null>(null);
  const [statsData, setStats] = useState<HealthStats | null>(null);
  const [upcoming, setUpcoming] = useState<Reminder[]>([]);
  const [latestVitals, setLatestVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      historyApi.list().catch(() => [] as Conversation[]),
      assessmentApi.history().catch(() => [] as AssessmentResult[]),
      statsApi.get().catch(() => null),
      remindersApi.upcoming(7).catch(() => [] as Reminder[]),
      vitalsApi.list().catch(() => [] as Vital[]),
    ]).then(([items, assessments, statsResult, due, vitals]) => {
      if (!live) return;
      setRecent(items.slice(0, 4));
      setLatestAssessment(assessments[0] || null);
      setStats(statsResult);
      setUpcoming(due);
      setLatestVitals(vitals);
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const name = user?.name?.split(" ")[0] || "there";
  const tip = healthTips[new Date().getDate() % healthTips.length];
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-rule bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-ink-2">Welcome back, {name}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">How can we support your health today?</h2>
            <p className="mt-2 text-sm leading-6 text-ink-2 font-read">Choose the way that feels easiest. MediAssist offers educational information and helps you decide when professional care is appropriate.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-[13px] text-ink-2"><ShieldCheck className="h-4 w-4 text-brand" />Educational only</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/chat"><Button><Plus className="h-4 w-4" />New consultation</Button></Link>
          <Link to="/hospitals"><Button variant="secondary"><MapPinned className="h-4 w-4" />Find nearby care</Button></Link>
        </div>
      </section>

      <EmergencyInlineNotice />
      {statsData && <HealthTrends stats={statsData} />}
      {latestVitals.length > 0 && <VitalsSnapshot vitals={latestVitals} />}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-bold text-ink">Due soon</p>
              <p className="mt-1 text-xs text-ink-2">Care reminders within the next 7 days.</p>
            </div>
            <Link to="/reminders" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-strong">All reminders <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-rule">
              {upcoming.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <BellRing className="h-4 w-4 shrink-0 text-ink-2" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{item.title}</span>{item.due_at && <span className="mt-0.5 block text-xs text-ink-2">{displayDate(item.due_at)}</span>}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-lg font-bold tracking-tight text-ink">Choose how you’d like to check in</h2>
        <Card className="mt-3">
          <CardContent>
            <ul className="divide-y divide-rule">
              {careTools.map((tool) => (
                <li key={tool.to}>
                  <Link to={tool.to} className="group flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <tool.icon className="h-5 w-5 shrink-0 text-ink-2 transition-colors group-hover:text-brand" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{tool.title}</span><span className="mt-0.5 block text-[13px] text-ink-2">{tool.copy}</span></span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-bold text-ink">Recent conversations</p>
              <p className="mt-1 text-xs text-ink-2">Pick up where you left off or start fresh.</p>
            </div>
            <Link to="/chat" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-strong">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
            ) : recent.length > 0 ? (
              <ul className="divide-y divide-rule">
                {recent.map((conversation) => (
                  <li key={conversation.id}>
                    <Link to={`/chat?conversation=${encodeURIComponent(conversation.id)}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <BotMessageSquare className="h-4 w-4 shrink-0 text-ink-2" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{conversation.title}</span><span className="mt-0.5 block truncate text-xs text-ink-2">{conversation.preview || "Continue this health conversation"}</span></span>
                      <span className="shrink-0 text-[11px] text-ink-2">{displayDate(conversation.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <BotMessageSquare className="mx-auto h-6 w-6 text-ink-2" />
                <p className="mt-3 text-sm font-semibold text-ink">No conversations yet</p>
                <p className="mt-1 text-xs text-ink-2">When you start a consultation, it will be saved here for easy follow-up.</p>
                <Link to="/chat" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-strong">Start a consultation <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <p className="text-sm font-bold text-ink">Today’s health tip</p>
                <p className="mt-1 text-xs text-ink-2">General wellbeing guidance</p>
              </div>
              <HeartPulse className="h-5 w-5 text-low" />
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold text-ink">{tip.title}</p>
              <p className="mt-1.5 text-sm leading-6 text-ink-2 font-read">{tip.copy}</p>
              <p className="mt-3 text-[13px] leading-5 text-ink-2">Also worth a look: {healthTips[(new Date().getDate() + 1) % healthTips.length].title.toLowerCase()} and {healthTips[(new Date().getDate() + 2) % healthTips.length].title.toLowerCase()}.</p>
            </CardContent>
          </Card>

          <Link to="/assessment" className="flex items-center gap-4 rounded-xl border border-rule bg-surface p-5 shadow-card transition-colors hover:bg-surface-alt">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-tint text-brand"><ShieldCheck className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{latestAssessment ? `Latest check-in · ${latestAssessment.risk_score}` : "Take a lifestyle check-in"}</span>
              <span className="mt-1 block text-[13px] leading-5 text-ink-2">{latestAssessment ? `${latestAssessment.risk_level} lifestyle risk · ${displayDate(latestAssessment.created_at)}` : "Get an educational risk score and actionable chat prompts."}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-ink-2" />
          </Link>

          <Link to="/reports" className="flex items-center gap-4 rounded-xl border border-rule bg-surface p-5 shadow-card transition-colors hover:bg-surface-alt">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-tint text-brand"><FileText className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">Need a summary?</span>
              <span className="mt-1 block text-[13px] leading-5 text-ink-2">Create a report from a consultation to share with a clinician.</span>
            </span>
            <ArrowRight className="h-4 w-4 text-ink-2" />
          </Link>
        </div>
      </section>
    </div>
  );
}
