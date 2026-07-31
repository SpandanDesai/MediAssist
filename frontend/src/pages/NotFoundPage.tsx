import { ArrowLeft, HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export function NotFoundPage() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950"><div><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"><HeartPulse className="h-7 w-7" /></span><p className="mt-6 text-sm font-bold uppercase tracking-[.15em] text-sky-600">Page not found</p><h1 className="mt-2 text-3xl font-bold">We could not find that page.</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Let’s get you back to a safe starting point.</p><Link to="/dashboard" className="mt-6 inline-block"><Button><ArrowLeft className="h-4 w-4" />Go to dashboard</Button></Link></div></div>;
}
