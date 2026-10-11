import { ArrowUpRight, Bot, ScanSearch, Shuffle } from "lucide-react";
import Link from "next/link";
import { Origin } from "@/components/origin";
import { Studio } from "@/components/studio";
import { ThemeToggle } from "@/components/theme-toggle";
import { DOCS_TEMPLATE_URL } from "@/content/addon";

const STEPS = [
  {
    icon: ScanSearch,
    title: "Find every reference",
    body: "An agent reads your script and pulls out each movie, show, song, brand, place and public figure, along with the job it does in the line.",
  },
  {
    icon: Bot,
    title: "Ask the taste graph",
    body: "Qloo says how present each one is in culture today, how each age group in your room feels about it compared with the average adult, and how it plays city by city.",
  },
  {
    icon: Shuffle,
    title: "Fix what won't land",
    body: "For references the room won't get, the agent finds substitutes that do the same job for this audience, checks them against Qloo, and rewrites the line.",
  },
];

export default function Home() {
  return (
    <>
      <div className="spotlight pointer-events-none absolute inset-x-0 top-0 h-[560px] print:hidden" aria-hidden />

      <header className="relative print:hidden">
        <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
            <span className="size-2.5 rounded-full bg-accent-glow shadow-[0_0_18px_5px_color-mix(in_srgb,var(--accent-glow)_55%,transparent)]" aria-hidden />
            Whoosh
          </Link>
          <div className="flex items-center gap-1 text-sm text-ink-soft sm:gap-5">
            <a href="#how" className="hidden hover:text-ink sm:inline">
              How it works
            </a>
            <a href="#agents" className="hidden hover:text-ink sm:inline">
              For agents (MCP)
            </a>
            {DOCS_TEMPLATE_URL && (
              <a href="#docs" className="hidden hover:text-ink md:inline">
                Google Docs
              </a>
            )}
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="relative mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 sm:px-6">
        <Studio />

        <section id="how" className="mt-28 scroll-mt-8 print:hidden">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">How it works</p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="card rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <step.icon className="size-5 text-accent" aria-hidden />
                  <span className="font-mono text-xs text-ink-faint">0{i + 1}</span>
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="agents" className="mt-6 scroll-mt-8 print:hidden">
          <div className="card grid grid-cols-1 gap-6 rounded-2xl p-6 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">For agents</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">Let your own agent check a script before it ships</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Whoosh can be called over MCP too. Any agent that writes speeches, ads or talks can call{" "}
                <code className="rounded bg-sunk px-1 py-0.5 font-mono text-[12px]">check_script</code> with a script and a room, and
                get the same verdicts and swaps.
              </p>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-sunk p-4 font-mono text-[12.5px] leading-relaxed text-ink-soft">
              <span className="text-ink-faint"># Claude Code</span>
              {"\n"}claude mcp add --transport http whoosh <Origin fallback="https://…" />
              /api/mcp
            </pre>
          </div>
        </section>

        {DOCS_TEMPLATE_URL && (
          <section id="docs" className="mt-4 scroll-mt-8 print:hidden">
            <div className="card flex flex-col gap-5 rounded-2xl p-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">In Google Docs</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">Check the script where you write it</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  A sidebar marks every reference in the document with how the room will read it and puts the swap you pick straight into the
                  text. Copy the template, then choose <strong className="font-medium text-ink">Whoosh → Check this room</strong>.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                  It isn&apos;t a published add-on, so the first time Google asks you to approve the script (Advanced → Go to Whoosh). It can
                  only see the document it&apos;s in.
                </p>
              </div>
              <a
                href={DOCS_TEMPLATE_URL}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-ink-faint md:self-center"
              >
                Make a copy
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-line print:hidden">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-6 text-xs text-ink-faint sm:flex-row sm:justify-between sm:px-6">
          <p>Built for the Qloo Agentic Hackathon. Taste data from Qloo describes aggregate audiences, never individuals.</p>
          <p>
            City list from{" "}
            <a href="https://www.geonames.org/" className="underline hover:text-ink">
              GeoNames
            </a>{" "}
            (CC BY 4.0).
          </p>
        </div>
      </footer>
    </>
  );
}
