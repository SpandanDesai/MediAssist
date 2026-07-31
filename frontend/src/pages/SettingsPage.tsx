import { Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { baseURL } from "../lib/api";

export function SettingsPage() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Appearance</p>
            <p className="mt-1 text-xs text-slate-500">Switch between light and dark mode. Preference is saved on this device.</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant={theme === "light" ? "primary" : "outline"} onClick={() => setTheme("light")}><Sun className="h-4 w-4" />Light</Button>
          <Button variant={theme === "dark" ? "primary" : "outline"} onClick={() => setTheme("dark")}><Moon className="h-4 w-4" />Dark</Button>
          <Button variant="ghost" onClick={toggleTheme}>Toggle</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Session</p>
            <p className="mt-1 text-xs text-slate-500">Signed in as {user?.email}. JWT session persists until you sign out.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>API endpoint: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{baseURL}</code></p>
          <Button variant="danger" onClick={logout}>Sign out</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Safety reminders</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p>MediAssist AI provides educational information only and never confirms a medical diagnosis.</p>
          <p>For emergencies—chest pain, difficulty breathing, stroke symptoms, severe bleeding, loss of consciousness, or suicidal thoughts—call local emergency services immediately.</p>
        </CardContent>
      </Card>
    </div>
  );
}
