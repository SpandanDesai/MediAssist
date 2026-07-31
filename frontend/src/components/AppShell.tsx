import { useState } from "react";
import { Bell, BotMessageSquare, Building2, FileText, HeartPulse, Home, ImagePlus, LogOut, MapPinned, Menu, Moon, Settings, ShieldCheck, Sun, UserRound, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { cn } from "../lib/utils";

const navigation = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/chat", label: "AI consultation", icon: BotMessageSquare },
  { to: "/voice", label: "Voice consultation", icon: HeartPulse },
  { to: "/image-analysis", label: "Image analysis", icon: ImagePlus },
  { to: "/hospitals", label: "Nearby care", icon: MapPinned },
  { to: "/assessment", label: "Health check-in", icon: ShieldCheck },
  { to: "/reports", label: "Reports", icon: FileText },
];

const lowerNavigation = [
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

const titleMap: Record<string, string> = {
  "/dashboard": "Your health space",
  "/chat": "AI consultation",
  "/voice": "Voice consultation",
  "/image-analysis": "Image analysis",
  "/hospitals": "Nearby healthcare",
  "/assessment": "Health check-in",
  "/reports": "Medical reports",
  "/profile": "Your profile",
  "/settings": "Settings",
};

function Brand() {
  return <NavLink to="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-950 dark:text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-glow"><HeartPulse className="h-5 w-5" /></span><span>Medi<span className="text-sky-500">Assist</span><span className="text-slate-400">AI</span></span></NavLink>;
}

function NavItems({ onClick }: { onClick?: () => void }) {
  const itemClass = ({ isActive }: { isActive: boolean }) => cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", isActive ? "bg-sky-500 text-white shadow-md shadow-sky-500/20" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white");
  return <>{navigation.map((item) => <NavLink key={item.to} to={item.to} onClick={onClick} className={itemClass}><item.icon className="h-4.5 w-4.5" />{item.label}</NavLink>)}<div className="my-3 border-t border-slate-200 dark:border-slate-800" />{lowerNavigation.map((item) => <NavLink key={item.to} to={item.to} onClick={onClick} className={itemClass}><item.icon className="h-4.5 w-4.5" />{item.label}</NavLink>)}</>;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = titleMap[location.pathname] || "MediAssist AI";
  const initials = user?.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "MA";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <Brand />
        <nav className="mt-8 flex-1 space-y-1"><NavItems /></nav>
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 p-4 text-white"><Building2 className="h-5 w-5" /><p className="mt-3 text-sm font-semibold">Need urgent care?</p><p className="mt-1 text-xs leading-5 text-sky-50">Find nearby hospitals and emergency rooms.</p><NavLink to="/hospitals" className="mt-3 inline-flex text-xs font-bold underline underline-offset-4">Find care</NavLink></div>
        <button onClick={logout} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30"><LogOut className="h-4.5 w-4.5" />Sign out</button>
      </aside>

      {menuOpen && <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)}><aside className="flex h-full w-[290px] flex-col bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><Brand /><button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div><nav className="mt-8 flex-1 space-y-1"><NavItems onClick={() => setMenuOpen(false)} /></nav><button onClick={logout} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><LogOut className="h-4.5 w-4.5" />Sign out</button></aside></div>}

      <main className="min-h-screen lg:pl-[268px]">
        <header className="sticky top-0 z-30 flex h-[73px] items-center justify-between border-b border-slate-200/80 bg-slate-50/85 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button onClick={() => setMenuOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">MediAssist AI</p><h1 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">{title}</h1></div></div><div className="flex items-center gap-1.5 sm:gap-3"><button onClick={toggleTheme} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Toggle dark mode">{theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}</button><button className="relative hidden rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 sm:block" aria-label="Notifications"><Bell className="h-4.5 w-4.5" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500" /></button><NavLink to="/profile" className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 text-left transition hover:bg-slate-200 dark:hover:bg-slate-800"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">{initials}</span><span className="hidden max-w-28 truncate text-sm font-semibold sm:block">{user?.name || "Your profile"}</span></NavLink></div></header>
        <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8"><Outlet /></div>
      </main>
    </div>
  );
}
