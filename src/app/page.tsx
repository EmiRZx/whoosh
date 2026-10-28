import { ArrowUpRight, Bot, ScanSearch, Shuffle } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { Origin } from "@/components/origin";
import { Studio } from "@/components/studio";
import { ThemeToggle } from "@/components/theme-toggle";
import { DOCS_TEMPLATE_URL } from "@/content/addon";

const MCP_TOOLS: [string, string][] = [
  ["check_script", "Every reference in a script, judged for a room and each city"],
  ["compare_rooms", "One script, up to four crowds, and where they split"],
  ["find_swaps", "Stand-ins that play the same part, measured and written into the line"],
  ["score_reference", "One name for one room: presence, room index, city ranks"],
  ["fans_of", "A performer's fans as Qloo sees them: ages and cities"],
  ["crowd_hooks", "Local places and artists a crowd loves in one city"],
];

const STEPS = [
  {
    icon: ScanSearch,
    title: "Spot the names",
    body: "Claude reads the script the way a writer would: a song counts as its artist, a catchphrase as its show, and every name comes with the work it's doing in its line.",
  },
  {
    icon: Bot,
    title: "Measure the room",
    body: "Qloo says how alive each name still is, how every age group in your crowd feels about it next to the average adult, and which cities on the tour claim it as their own.",
  },
  {
    icon: Shuffle,
    title: "Swap what misses",
    body: "For a name that would sail past them, an agent hunts Qloo for one this crowd loves that plays the same part, tests it the same way, and writes it into the line.",
  },
];

export default function Home() {
  return (
    <>
      <div className="spotlight pointer-events-none absolute inset-x-0 top-0 h-[560px] print:hidden" aria-hidden />

      <header className="relative print:hidden">
        <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
            <LogoMark />
            <span className="font-display tracking-[-0.02em]">Whoosh</span>
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

        <section id="why" className="mt-6 scroll-mt-8 print:hidden">
          <div className="card grid grid-cols-1 gap-6 rounded-2xl p-6 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Taste data vs. a good guess</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">A model knows the names. It doesn&apos;t know who&apos;s in your room.</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Before it sees a single number, Claude makes its own call on every name, and the results page sets that call next to
                Qloo&apos;s. Across 21 scripts that were actually performed (presidential roasts, talks, stand-up sets, wedding toasts):
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="flex items-baseline gap-3">
                <span className="w-28 shrink-0 whitespace-nowrap text-4xl font-semibold leading-none tracking-tight">1 in 3</span>
                <span className="text-sm leading-snug text-ink-soft">names where the model&apos;s call and Qloo&apos;s numbers parted ways (78 of 227)</span>
              </p>
              <p className="flex items-baseline gap-3">
                <span className="w-28 shrink-0 whitespace-nowrap text-4xl font-semibold leading-none tracking-tight">6 of 14</span>
                <span className="text-sm leading-snug text-ink-soft">names Qloo marks as misses that the model called safe</span>
              </p>
            </div>
          </div>
        </section>

        <section id="agents" className="mt-6 scroll-mt-8 print:hidden">
          <div className="card grid grid-cols-1 gap-6 rounded-2xl p-6 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">For agents</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">Let your own agent check a script before it ships</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Agents can call Whoosh too, over MCP. One that drafts toasts, talks or ad copy can test its draft on the crowd it&apos;s
                for, find out which crowd a script suits best, and trade out the names that miss, with the same Qloo measurements as
                this page.
              </p>
              <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                {MCP_TOOLS.map(([name, what]) => (
                  <li key={name}>
                    <code className="font-mono text-[12px] text-ink">{name}</code>
                    <span className="block text-xs leading-snug text-ink-soft">{what}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 lg:justify-center">
              <pre className="overflow-x-auto rounded-xl bg-sunk p-4 font-mono text-[12.5px] leading-relaxed text-ink-soft">
                <span className="text-ink-faint"># Claude Code</span>
                {"\n"}claude mcp add --transport http whoosh <Origin fallback="https://…" />
                /api/mcp
              </pre>
              <pre className="overflow-x-auto rounded-xl bg-sunk p-4 font-mono text-[12.5px] leading-relaxed text-ink-soft">
                <span className="text-ink-faint"># Then ask</span>
                {"\n"}Here&apos;s my toast for my grandpa&apos;s 80th. Will his friends get the references? Fix the ones they won&apos;t.
              </pre>
            </div>
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
