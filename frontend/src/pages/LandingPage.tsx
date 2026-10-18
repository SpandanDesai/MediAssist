import { ArrowRight, BotMessageSquare, CheckCircle2, HeartHandshake, HeartPulse, ImagePlus, LockKeyhole, MapPinned, Mic, ShieldCheck, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

const features = [
  { icon: BotMessageSquare, title: "Thoughtful symptom conversations", copy: "Share what you are experiencing and receive clear, cautious educational guidance." },
  { icon: Mic, title: "Speak naturally", copy: "Use a voice consultation when typing is inconvenient, with a transcript you can review." },
  { icon: ImagePlus, title: "Understand visible concerns", copy: "Upload a skin, eye, swelling, or minor-wound image for a descriptive AI assessment." },
  { icon: MapPinned, title: "Find care nearby", copy: "Use your location to find nearby hospitals, clinics, and emergency facilities." },
];

const steps = [
  { title: "Share what’s going on", copy: "Type, speak, or upload an image of a visible concern.", icon: HeartHandshake },
  { title: "Understand the picture", copy: "Get possible explanations, relevant follow-up questions, and a clear urgency signal.", icon: Stethoscope },
  { title: "Choose the next step", copy: "Use guidance for home care, scheduling care, or finding a nearby hospital.", icon: MapPinned },
];

const principles = [
  "Never presents an AI response as a confirmed diagnosis",
  "Flags urgent symptoms and directs you to immediate care",
  "Explains uncertainty, possible conditions, and sensible next steps",
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand"><HeartPulse className="h-5 w-5" /></span>
      <span>Medi<span className="text-brand">Assist</span> <span className="font-semibold text-ink-2">AI</span></span>
    </Link>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-rule bg-surface">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-2 md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a>
            <a href="#safety" className="transition-colors hover:text-ink">Safety</a>
            <a href="#features" className="transition-colors hover:text-ink">Features</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/signup"><Button size="sm">Create your health space</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">Health guidance that helps you decide <span className="text-brand">what to do next.</span></h1>
            <p className="mt-6 text-base leading-7 text-ink-2 font-read sm:text-lg">MediAssist AI brings text, voice, and image-based health conversations into one private, easy-to-use space—always educational, never a substitute for a clinician.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup"><Button size="lg">Start a consultation <ArrowRight className="h-4 w-4" /></Button></Link>
              <a href="#how-it-works"><Button variant="secondary" size="lg">See how it works</Button></a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-2">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-low" />Designed around caution</span>
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-4 w-4 text-low" />Your data stays protected</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-rule bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-brand"><HeartPulse className="h-4 w-4" /></span>
                  <div><p className="text-sm font-bold text-ink">MediAssist</p><p className="text-[11px] text-ink-2">Educational guidance</p></div>
                </div>
                <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-ink-2">Educational only</span>
              </div>
              <div className="space-y-3 pt-4">
                <div className="max-w-[88%] rounded-xl rounded-bl-sm bg-surface-alt px-3.5 py-2.5 text-sm leading-6 text-ink font-read">I’ve had a sore throat and fever for two days. What should I watch for?</div>
                <div className="ml-auto max-w-[92%] rounded-xl rounded-br-sm bg-brand-tint px-3.5 py-2.5 text-sm leading-6 text-ink font-read">Rest and fluids may help, but a few details matter — your temperature and any trouble breathing.</div>
                <div className="rounded-xl border border-rule p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Summary</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-med-tint px-2 py-0.5 text-[11px] font-semibold text-med"><span className="h-1.5 w-1.5 rounded-full bg-med" />Medium urgency</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink font-read">What to do: supportive care at home; see a clinician if symptoms worsen or breathing becomes difficult.</p>
                  <ul className="mt-2 divide-y divide-rule text-sm text-ink-2 font-read">
                    {["Viral upper respiratory infection", "Strep throat (pharyngitis)", "Influenza-like illness"].map((c) => (
                      <li key={c} className="flex items-center justify-between py-1.5"><span>{c}</span><span className="text-[11px]">estimated</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-rule bg-surface py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Clear support in three simple moments.</h2>
            <div className="relative mt-12 grid gap-8 md:grid-cols-3">
              <div className="absolute inset-x-0 top-6 hidden h-px bg-rule md:block" aria-hidden="true" />
              {steps.map((step) => (
                <div key={step.title} className="relative">
                  <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-rule bg-surface text-brand"><step.icon className="h-5 w-5" /></span>
                  <h3 className="mt-5 text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-2 font-read">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Meet people where they are.</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-rule bg-surface p-7 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-tint text-brand"><BotMessageSquare className="h-5 w-5" /></span>
              <h3 className="mt-5 text-xl font-bold text-ink">{features[0].title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-2 font-read">{features[0].copy}</p>
              <div className="mt-6 space-y-2 rounded-xl bg-surface-alt p-4 text-sm font-read">
                <p className="text-ink-2"><span className="font-semibold text-ink">You:</span> I’ve had a sore throat and fever for two days.</p>
                <p className="text-ink-2"><span className="font-semibold text-ink">MediAssist:</span> Here’s what that could mean, how urgent it may be, and what to do next.</p>
              </div>
            </div>
            <ul className="divide-y divide-rule rounded-2xl border border-rule bg-surface px-7 shadow-card">
              {features.slice(1).map((feature) => (
                <li key={feature.title} className="flex gap-4 py-6 first:pt-7 last:pb-7">
                  <feature.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <div><h3 className="font-bold text-ink">{feature.title}</h3><p className="mt-1 text-sm leading-6 text-ink-2 font-read">{feature.copy}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="safety" className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <div className="rounded-2xl border border-rule bg-surface-alt px-6 py-10 sm:px-10 lg:grid lg:grid-cols-[1fr_.9fr] lg:items-center lg:gap-12 lg:px-14">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Helpful does not mean overconfident.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-ink-2 font-read sm:text-base">MediAssist is designed to communicate uncertainty and make escalation easy. It cannot diagnose, replace a clinician, or provide emergency services.</p>
              <Link to="/about" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand hover:text-brand-strong">Read our approach <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ul className="mt-8 space-y-3 lg:mt-0">
              {principles.map((principle) => (
                <li key={principle} className="flex gap-3 rounded-xl border border-rule bg-surface px-4 py-3 text-sm leading-6 text-ink font-read"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-low" />{principle}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-surface px-5 py-8 text-center text-[13px] text-ink-2">© {new Date().getFullYear()} MediAssist AI · Informational health support, not medical diagnosis or emergency care.</footer>
    </div>
  );
}
