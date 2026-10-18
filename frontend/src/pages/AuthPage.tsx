import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, HeartPulse, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiErrorMessage } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input, Label, Select } from "../components/ui/form";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", age: "", gender: "" });
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/dashboard";

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (isSignup && form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setPending(true);
    try {
      if (isSignup) await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password, age: form.age ? Number(form.age) : undefined, gender: form.gender || undefined });
      else await login({ email: form.email.trim(), password: form.password });
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(apiErrorMessage(reason, isSignup ? "We could not create your account." : "We could not sign you in."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[.95fr_1.05fr]">
      <aside className="hidden overflow-hidden border-r border-rule bg-surface p-10 lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand"><HeartPulse className="h-5 w-5" /></span>
          Medi<span className="text-brand">Assist</span> <span className="font-semibold text-ink-2">AI</span>
        </Link>
        <div className="my-auto max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink">Guidance designed to be useful—and honest about its limits.</h1>
          <p className="mt-5 text-base leading-7 text-ink-2 font-read">Start a private health-support space for symptom conversations, voice notes, visible concerns, and nearby-care searches.</p>
          <div className="mt-10 space-y-4">
            {["Educational guidance, not a medical diagnosis", "Urgent symptoms are clearly escalated", "Your medical details are optional and under your control"].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-ink font-read"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-low" />{item}</div>
            ))}
          </div>
        </div>
        <p className="text-[13px] leading-5 text-ink-2">If you may be having a medical emergency, call local emergency services now. Do not wait to create an account.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink lg:hidden"><ArrowLeft className="h-4 w-4" />Back to home</Link>
          <div className="mt-8 lg:mt-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand lg:hidden"><HeartPulse className="h-5 w-5" /></div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">{isSignup ? "Create your health space" : "Welcome back"}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-2 font-read">{isSignup ? "Start with the basics—you can add medical details later." : "Sign in to continue your health-support journey."}</p>
          </div>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            {isSignup && <div><Label htmlFor="name">Full name</Label><Input id="name" value={form.name} onChange={update("name")} required autoComplete="name" placeholder="Your name" /></div>}
            <div><Label htmlFor="email">Email address</Label><Input id="email" type="email" value={form.email} onChange={update("email")} required autoComplete="email" placeholder="you@example.com" /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={form.password} onChange={update("password")} required minLength={isSignup ? 8 : undefined} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 8 characters" : "Your password"} /></div>
            {isSignup && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="age">Age <span className="font-normal text-ink-2">(optional)</span></Label><Input id="age" type="number" min="0" max="120" value={form.age} onChange={update("age")} placeholder="e.g. 28" /></div>
                <div>
                  <Label htmlFor="gender">Gender <span className="font-normal text-ink-2">(optional)</span></Label>
                  <Select id="gender" value={form.gender} onChange={update("gender")}>
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="nonbinary">Non-binary</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl border border-danger/30 bg-danger-tint px-3.5 py-3 text-sm text-ink font-read">
                <p>{error}</p>
                {isSignup && <p className="mt-2">Already registered? <Link to="/login" className="font-bold text-danger underline underline-offset-2">Log in</Link></p>}
                {!isSignup && <p className="mt-2">Need an account? <Link to="/signup" className="font-bold text-danger underline underline-offset-2">Sign up</Link></p>}
              </div>
            )}
            <Button type="submit" className="mt-2 w-full" size="lg" disabled={pending}>{pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}<ArrowRight className="h-4 w-4" /></Button>
          </form>
          <p className="mt-6 text-center text-sm text-ink-2">{isSignup ? "Already have an account?" : "New to MediAssist?"} <Link to={isSignup ? "/login" : "/signup"} className="font-bold text-brand hover:text-brand-strong">{isSignup ? "Sign in" : "Create an account"}</Link></p>
          <div className="mt-8 flex gap-2 rounded-xl bg-surface-alt p-3 text-[13px] leading-5 text-ink-2 font-read"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />MediAssist provides informational support only. It is not a medical diagnosis, treatment plan, or emergency service.</div>
        </div>
      </main>
    </div>
  );
}
