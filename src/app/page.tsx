import { Workbench } from "@/components/workbench";

const STEPS = [
  {
    title: "Find every reference",
    body: "An agent reads your script and pulls out each movie, show, song, brand, place and public figure, along with the job it does in the line.",
  },
  {
    title: "Ask the taste graph",
    body: "Qloo says how widely each one is known, how each age group in your room feels about it, how it plays city by city, and whether it's rising or fading.",
  },
  {
    title: "Fix what won't land",
    body: "For references the room won't get, the agent finds substitutes that do the same job for this audience, checks them against Qloo, and rewrites the line.",
  },
];

export default function Home() {
  return (
    <>
      <header className="bg-stage pb-32 text-stage-ink">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <span className="flex items-center gap-2 font-display text-2xl">
            <span className="size-2.5 rounded-full bg-spot shadow-[0_0_18px_4px_rgba(242,177,52,0.55)]" aria-hidden />
            Whoosh
          </span>
          <a href="#how" className="text-sm text-stage-ink-soft hover:text-stage-ink">
            How it works
          </a>
        </nav>
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-16">
          <h1 className="max-w-3xl font-display text-5xl leading-[1.02] sm:text-7xl">
            Will they get the <em className="text-spot">reference</em>?
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stage-ink-soft">
            Bring a tight five, a toast, a lecture or a keynote, and say who's listening. Whoosh checks every cultural reference against what
            that audience actually loves, using Qloo&apos;s taste graph, and helps you swap the ones that won&apos;t land.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-20 w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <Workbench />

        <section id="how" className="mt-24 grid gap-10 border-t border-rule pt-12 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <span className="font-display text-4xl text-spot">{i + 1}</span>
              <h2 className="mt-2 font-display text-2xl">{step.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-rule">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-faint sm:px-6">
          Built for the Qloo Agentic Hackathon. Taste data from Qloo describes aggregate audiences, never individuals.
        </p>
      </footer>
    </>
  );
}
