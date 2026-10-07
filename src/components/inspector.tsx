"use client";

import type { AnalyzedReference, Verdict } from "@/lib/analysis/types";
import { KIND_LABEL, VERDICT_LABEL, WEIGHT_LABEL } from "./labels";

const VERDICT_CHIP: Record<Verdict, string> = {
  lands: "bg-lands text-lands-ink",
  risky: "bg-risky text-risky-ink",
  dead: "bg-dead text-dead-ink",
  unchecked: "bg-unchecked text-unchecked-ink",
};

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERDICT_CHIP[verdict]}`}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

export function Inspector({ reference }: { reference?: AnalyzedReference }) {
  if (!reference) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-2xl">Pick a reference</p>
        <p className="max-w-xs text-sm text-ink-soft">
          Click any highlighted name in your script to see how this room reads it.
        </p>
      </div>
    );
  }

  const { extracted, resolution } = reference;
  const pending = resolution.status === "pending";
  const notCheckable = resolution.status === "not_checkable";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictChip verdict={reference.verdict} />
          <span className="text-xs text-ink-soft">
            {KIND_LABEL[extracted.kind]} · {WEIGHT_LABEL[extracted.weight]}
          </span>
        </div>
        <h2 className="font-display text-3xl leading-tight">{extracted.name}</h2>
        {extracted.disambiguation && <p className="text-sm text-ink-soft">{extracted.disambiguation}</p>}
      </header>

      <Section title="What it does in the line">
        <p className="text-[15px] leading-relaxed">{extracted.role}</p>
        <p className="mt-2 flex flex-wrap gap-1.5">
          {extracted.quotes.map((q, i) => (
            <span key={i} className="rounded bg-paper-sunk px-1.5 py-0.5 font-script text-xs">
              {q}
            </span>
          ))}
        </p>
      </Section>

      <Section title="How this room reads it">
        {notCheckable ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Events, memes and trends aren&apos;t in a taste graph, so this one is your call.
          </p>
        ) : pending ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Waiting on the Qloo check. Recognition, how this room&apos;s age groups feel about it, how it plays in each
            city and whether it&apos;s rising or fading will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {reference.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}
      </Section>

      {reference.swaps.length > 0 && (
        <Section title="Swaps that do the same job">
          <ul className="flex flex-col gap-3">
            {reference.swaps.map((swap) => (
              <li key={swap.entity.id} className="rounded-lg border border-rule bg-paper-raised p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{swap.entity.name}</span>
                  <VerdictChip verdict={swap.verdict} />
                </div>
                <p className="mt-1 text-sm text-ink-soft">{swap.why}</p>
                <p className="mt-2 font-script text-sm">{swap.rewrite}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
