import { useState } from "react";
import { BotMessageSquare, BellRing, FileText, HeartPulse, Home, ImagePlus, LogOut, MapPinned, Menu, Moon, Phone, Settings, ShieldCheck, Sun, UserRound, X } from "lucide-react";
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
  { to: "/reminders", label: "Reminders", icon: BellRing },
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
  "/hospitals": "Nearby care",
  "/assessment": "Health check-in",
  "/reminders": "Care reminders",
  "/reports": "Medical reports",
  "/profile": "Your profile",
  "/settings": "Settings",
};

function Brand() {
  return (
    <NavLink to="/dashboard" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-ink">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint text-brand"><HeartPulse className="h-5 w-5" /></span>
      <span>Medi<span className="text-brand">Assist</span> <span className="font-semibold text-ink-2">AI</span></span>
    </NavLink>
  );
}

function NavItems({ onClick }: { onClick?: () => void }) {
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      isActive ? "bg-brand-tint text-brand" : "text-ink-2 hover:bg-surface-alt hover:text-ink");
  return (
    <>
      {navigation.map((item) => <NavLink key={item.to} to={item.to} onClick={onClick} className={itemClass}><item.icon className="h-[18px] w-[18px]" />{item.label}</NavLink>)}
      <div className="my-3 border-t border-rule" />
      {lowerNavigation.map((item) => <NavLink key={item.to} to={item.to} onClick={onClick} className={itemClass}><item.icon className="h-[18px] w-[18px]" />{item.label}</NavLink>)}
    </>
  );
}

function SupportCard() {
  return (
    <div className="rounded-xl border border-rule bg-surface-alt p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><MapPinned className="h-4 w-4 text-brand" />Need care soon?</p>
      <p className="mt-1 text-[13px] leading-5 text-ink-2">Find nearby hospitals and emergency rooms.</p>
      <NavLink to="/hospitals" className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">Find care <span aria-hidden>→</span></NavLink>
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = titleMap[location.pathname] || "MediAssist AI";
  const initials = user?.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "MA";
  const emergencyNumber = import.meta.env.VITE_EMERGENCY_NUMBER || "112";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-rule bg-surface p-5 lg:flex">
        <Brand />
        <p className="mt-8 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-2">Care</p>
        <nav className="mt-2 flex-1 space-y-1"><NavItems /></nav>
        <SupportCard />
        <button onClick={logout} className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-danger-tint hover:text-danger"><LogOut className="h-[18px] w-[18px]" />Sign out</button>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <aside className="flex h-full w-[290px] flex-col border-r border-rule bg-surface p-5 shadow-overlay" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><Brand /><button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-alt" aria-label="Close navigation"><X className="h-5 w-5" /></button></div>
            <nav className="mt-6 flex-1 space-y-1"><NavItems onClick={() => setMenuOpen(false)} /></nav>
            <SupportCard />
            <button onClick={logout} className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-2 hover:bg-danger-tint hover:text-danger"><LogOut className="h-[18px] w-[18px]" />Sign out</button>
          </aside>
        </div>
      )}

      <main className="min-h-screen lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-rule bg-surface px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-alt lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            <h1 className="text-lg font-bold tracking-tight text-ink">{title}</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button onClick={toggleTheme} className="rounded-lg border border-rule p-2.5 text-ink-2 transition-colors hover:bg-surface-alt hover:text-ink" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}</button>
            <NavLink to="/profile" className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-surface-alt">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[12px] font-bold text-brand-fg">{initials}</span>
              <span className="hidden max-w-32 truncate text-sm font-semibold text-ink sm:block">{user?.name || "Your profile"}</span>
            </NavLink>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8"><Outlet /></div>
        <div className="sticky bottom-0 z-20 border-t border-rule bg-surface px-4 py-3 lg:hidden">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3">
            <a href={`tel:${emergencyNumber}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-danger text-sm font-bold text-danger-fg"><Phone className="h-4 w-4" />Call {emergencyNumber}</a>
            <NavLink to="/hospitals" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-rule bg-surface text-sm font-bold text-ink"><MapPinned className="h-4 w-4" />Nearby care</NavLink>
          </div>
        </div>
      </main>
    </div>
  );
}
