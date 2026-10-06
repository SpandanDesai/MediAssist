from pathlib import Path
ROOT = Path(r"c:\Users\Spandan\Documents\GitHub\MediAssist")

# --- Dashboard ---
dash = (ROOT / "frontend/src/pages/DashboardPage.tsx").read_text(encoding="utf-8")

# Update imports
dash = dash.replace(
    'import { ArrowRight, BotMessageSquare, FileText, HeartPulse, ImagePlus, MapPinned, Mic, Plus, ShieldCheck } from "lucide-react";',
    'import { ArrowRight, BotMessageSquare, FileText, HeartPulse, ImagePlus, MapPinned, Mic, Plus, ShieldCheck } from "lucide-react";',
)
dash = dash.replace(
    'import { historyApi } from "../lib/api";\nimport { displayDate } from "../lib/utils";\nimport type { Conversation } from "../types";',
    'import { assessmentApi, historyApi } from "../lib/api";\nimport { displayDate } from "../lib/utils";\nimport type { AssessmentResult, Conversation } from "../types";',
)

# Add assessment to care tools
old_tools = '''const careTools = [
  { to: "/chat", icon: BotMessageSquare, title: "Start a text consultation", copy: "Describe symptoms and get cautious next-step guidance.", tone: "bg-sky-500" },
  { to: "/voice", icon: Mic, title: "Talk it through", copy: "Record a voice consultation when typing is not ideal.", tone: "bg-violet-500" },
  { to: "/image-analysis", icon: ImagePlus, title: "Analyze an image", copy: "Share a visible skin or minor-wound concern safely.", tone: "bg-emerald-500" },
];'''
new_tools = '''const careTools = [
  { to: "/chat", icon: BotMessageSquare, title: "Start a text consultation", copy: "Describe symptoms and get cautious next-step guidance.", tone: "bg-sky-500" },
  { to: "/voice", icon: Mic, title: "Talk it through", copy: "Record a voice consultation when typing is not ideal.", tone: "bg-violet-500" },
  { to: "/image-analysis", icon: ImagePlus, title: "Analyze an image", copy: "Share a visible skin or minor-wound concern safely.", tone: "bg-emerald-500" },
  { to: "/assessment", icon: ShieldCheck, title: "Lifestyle check-in", copy: "Score habits, track trend, and jump into a guided chat.", tone: "bg-amber-500" },
];'''
if old_tools not in dash:
    raise SystemExit("careTools missing")
dash = dash.replace(old_tools, new_tools)

# Update grid for 4 tools
dash = dash.replace(
    '<div className="grid gap-4 lg:grid-cols-3">{careTools.map',
    '<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{careTools.map',
)

# Add latest assessment state + fetch
old_state = '''  const [recent, setRecent] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    historyApi.list().then((items) => { if (live) setRecent(items.slice(0, 4)); }).catch(() => { if (live) setRecent([]); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);'''
new_state = '''  const [recent, setRecent] = useState<Conversation[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      historyApi.list().catch(() => [] as Conversation[]),
      assessmentApi.history().catch(() => [] as AssessmentResult[]),
    ]).then(([items, assessments]) => {
      if (!live) return;
      setRecent(items.slice(0, 4));
      setLatestAssessment(assessments[0] || null);
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);'''
if old_state not in dash:
    raise SystemExit("dashboard state block missing")
dash = dash.replace(old_state, new_state)

# Insert assessment card before reports link - find the reports Link and prepend
reports_link = '''<Link to="/reports" className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 transition hover:border-emerald-200 hover:bg-emerald-100/60 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40">'''
assessment_card = '''{latestAssessment ? (
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
        ''' + reports_link
if reports_link not in dash:
    raise SystemExit("reports link missing")
dash = dash.replace(reports_link, assessment_card, 1)

(ROOT / "frontend/src/pages/DashboardPage.tsx").write_text(dash, encoding="utf-8")
print("OK Dashboard")

# --- AppShell: mobile emergency bar + remove stub bell ---
shell = (ROOT / "frontend/src/components/AppShell.tsx").read_text(encoding="utf-8")
shell = shell.replace(
    'import { Bell, BotMessageSquare, Building2, FileText, HeartPulse, Home, ImagePlus, LogOut, MapPinned, Menu, Moon, Settings, ShieldCheck, Sun, UserRound, X } from "lucide-react";',
    'import { BotMessageSquare, Building2, FileText, HeartPulse, Home, ImagePlus, LogOut, MapPinned, Menu, Moon, Phone, Settings, ShieldCheck, Sun, UserRound, X } from "lucide-react";',
)

# Remove stub notifications button
old_bell = '''<button className="relative hidden rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 sm:block" aria-label="Notifications"><Bell className="h-4.5 w-4.5" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500" /></button>'''
shell = shell.replace(old_bell, "")

# Add sticky mobile emergency bar before closing main
emergency_number = '${import.meta.env.VITE_EMERGENCY_NUMBER || "112"}'
# Actually in the TSX file we need a const - add after titleMap usage
if "StickyEmergencyBar" not in shell:
    shell = shell.replace(
        "  const initials = user?.name.split(\" \").map((part) => part[0]).join(\"\").slice(0, 2).toUpperCase() || \"MA\";",
        "  const initials = user?.name.split(\" \").map((part) => part[0]).join(\"\").slice(0, 2).toUpperCase() || \"MA\";\n  const emergencyNumber = import.meta.env.VITE_EMERGENCY_NUMBER || \"112\";",
    )
    insert = '''        <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8"><Outlet /></div>
        <div className="sticky bottom-0 z-20 border-t border-rose-200 bg-rose-50/95 px-4 py-3 backdrop-blur lg:hidden dark:border-rose-900/70 dark:bg-rose-950/90">
          <div className="mx-auto flex max-w-[1480px] items-center gap-3">
            <a href={`tel:${emergencyNumber}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-bold text-white">
              <Phone className="h-4 w-4" />Call {emergencyNumber}
            </a>
            <NavLink to="/hospitals" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-200">
              <MapPinned className="h-4 w-4" />Nearby care
            </NavLink>
          </div>
        </div>'''
    old_outlet = '''        <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8"><Outlet /></div>'''
    if old_outlet not in shell:
        raise SystemExit("outlet block missing")
    shell = shell.replace(old_outlet, insert)

(ROOT / "frontend/src/components/AppShell.tsx").write_text(shell, encoding="utf-8")
print("OK AppShell")
