import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, HeartPulse, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiErrorMessage } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/form";

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
    <div className="grid min-h-screen bg-white dark:bg-slate-950 lg:grid-cols-[.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col"><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.42),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(34,197,94,.2),transparent_32%)]" /><Link to="/" className="relative flex items-center gap-2.5 text-lg font-bold"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white"><HeartPulse className="h-5 w-5" /></span>Medi<span className="text-sky-300">Assist</span> AI</Link><div className="relative my-auto max-w-md"><div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-sky-100 w-fit">Your health questions deserve care</div><h1 className="mt-5 text-4xl font-bold leading-tight">Guidance designed to be useful—and honest about its limits.</h1><p className="mt-5 text-base leading-7 text-slate-300">Start a private health-support space for symptom conversations, voice notes, visible concerns, and nearby-care searches.</p><div className="mt-10 space-y-4">{["Educational guidance, not a medical diagnosis", "Urgent symptoms are clearly escalated", "Your medical details are optional and under your control"].map((item) => <div key={item} className="flex items-start gap-3 text-sm text-slate-200"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</div>)}</div></div><p className="relative text-xs leading-5 text-slate-400">If you may be having a medical emergency, call local emergency services now. Do not wait to create an account.</p></aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-8"><div className="w-full max-w-md"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-sky-600 dark:text-slate-400 lg:hidden"><ArrowLeft className="h-4 w-4" />Back to home</Link><div className="mt-8 lg:mt-0"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300 lg:hidden"><HeartPulse className="h-5 w-5" /></div><p className="mt-6 text-sm font-bold uppercase tracking-[.14em] text-sky-600">MediAssist AI</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{isSignup ? "Create your health space" : "Welcome back"}</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{isSignup ? "Start with the basics—you can add medical details later." : "Sign in to continue your health-support journey."}</p></div><form className="mt-7 space-y-4" onSubmit={submit}>{isSignup && <div><Label htmlFor="name">Full name</Label><Input id="name" value={form.name} onChange={update("name")} required autoComplete="name" placeholder="Your name" /></div>}<div><Label htmlFor="email">Email address</Label><Input id="email" type="email" value={form.email} onChange={update("email")} required autoComplete="email" placeholder="you@example.com" /></div><div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={form.password} onChange={update("password")} required minLength={isSignup ? 8 : undefined} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 8 characters" : "Your password"} /></div>{isSignup && <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="age">Age <span className="font-normal text-slate-400">(optional)</span></Label><Input id="age" type="number" min="0" max="120" value={form.age} onChange={update("age")} placeholder="e.g. 28" /></div><div><Label htmlFor="gender">Gender <span className="font-normal text-slate-400">(optional)</span></Label><select id="gender" value={form.gender} onChange={update("gender")} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option><option value="other">Other</option></select></div></div>}{error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                <p>{error}</p>
                {isSignup && (
                  <p className="mt-2">
                    Already registered?{" "}
                    <Link to="/login" className="font-bold underline underline-offset-2 hover:text-rose-900 dark:hover:text-rose-100">
                      Log in
                    </Link>
                  </p>
                )}
                {!isSignup && (
                  <p className="mt-2">
                    Need an account?{" "}
                    <Link to="/signup" className="font-bold underline underline-offset-2 hover:text-rose-900 dark:hover:text-rose-100">
                      Sign up
                    </Link>
                  </p>
                )}
              </div>
            )}<Button type="submit" className="mt-2 w-full" size="lg" disabled={pending}>{pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}<ArrowRight className="h-4 w-4" /></Button></form><p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{isSignup ? "Already have an account?" : "New to MediAssist?"} <Link to={isSignup ? "/login" : "/signup"} className="font-bold text-sky-600 hover:text-sky-700">{isSignup ? "Sign in" : "Create an account"}</Link></p><div className="mt-8 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />MediAssist provides informational support only. It is not a medical diagnosis, treatment plan, or emergency service.</div></div></main>
    </div>
  );
}
