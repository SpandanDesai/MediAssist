import { ArrowLeft, HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-center text-ink">
      <div>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand-tint text-brand"><HeartPulse className="h-7 w-7" /></span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">We could not find that page.</h1>
        <p className="mt-3 text-sm text-ink-2">Let’s get you back to a safe starting point.</p>
        <Link to="/dashboard" className="mt-6 inline-block"><Button><ArrowLeft className="h-4 w-4" />Go to dashboard</Button></Link>
      </div>
    </div>
  );
}
