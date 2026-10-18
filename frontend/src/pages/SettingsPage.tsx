import { Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Appearance</p>
            <p className="mt-1 text-xs text-ink-2">Choose how MediAssist looks on this device.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-lg border border-rule bg-surface-alt p-1">
            <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={cn("flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors", theme === "light" ? "bg-surface text-brand shadow-card" : "text-ink-2 hover:text-ink")}>
              <Sun className="h-4 w-4" aria-hidden="true" />Light
            </button>
            <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={cn("flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors", theme === "dark" ? "bg-surface text-brand shadow-card" : "text-ink-2 hover:text-ink")}>
              <Moon className="h-4 w-4" aria-hidden="true" />Dark
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-2">Your theme is saved on this device.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div><p className="text-sm font-bold text-ink">Session</p></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-[12px] font-bold text-brand-fg">{user?.name?.slice(0, 2).toUpperCase() || "MA"}</span>
            <div>
              <p className="text-sm font-semibold text-ink">Signed in as {user?.email}</p>
              <p className="text-xs text-ink-2">You stay signed in on this device until you sign out.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="danger-outline" onClick={logout}>Sign out</Button>
            <span className="text-xs text-ink-2">Signing out ends your session on this device.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div><p className="text-sm font-bold text-ink">Safety</p></div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-6 text-ink-2 font-read">
          <p>MediAssist AI provides educational information only and never confirms a medical diagnosis.</p>
          <p>For emergencies—chest pain, difficulty breathing, stroke symptoms, severe bleeding, loss of consciousness, or suicidal thoughts—call local emergency services immediately.</p>
        </CardContent>
      </Card>
    </div>
  );
}
