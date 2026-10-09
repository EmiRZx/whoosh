"use client";

import type { AnalyzedReference, Signals, Verdict } from "@/lib/analysis/types";
import { AGE_BUCKETS } from "@/lib/qloo/api";
import { AGE_LABELS, KIND_LABEL, VERDICT_LABEL, WEIGHT_LABEL } from "./labels";

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

const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;

function AgeChart({ age }: { age: NonNullable<Signals["age"]> }) {
  const max = Math.max(0.25, ...AGE_BUCKETS.map((b) => Math.abs(age[b] ?? 0)));
  return (
    <div className="flex flex-col gap-1">
      {AGE_BUCKETS.map((bucket, i) => {
        const v = age[bucket];
        const width = v === undefined ? 0 : (Math.abs(v) / max) * 50;
        return (
          <div key={bucket} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs">
            <span className="text-ink-soft">{AGE_LABELS[i]}</span>
            <span className="relative h-2.5 rounded-sm bg-paper-sunk">
              <span className="absolute inset-y-0 left-1/2 w-px bg-rule" aria-hidden />
              {v !== undefined && (
                <span
                  className={`absolute inset-y-0 rounded-sm ${v >= 0 ? "bg-lands-ink/70" : "bg-dead-ink/60"}`}
                  style={v >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                />
              )}
            </span>
            <span className="text-right tabular-nums">{v === undefined ? "–" : signed(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignalsView({ signals }: { signals: Signals }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-paper-sunk px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">This room vs. average</p>
          <p className="font-display text-3xl leading-tight">{signals.roomIndex === undefined ? "–" : signed(signals.roomIndex)}</p>
        </div>
        <div className="rounded-lg bg-paper-sunk px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Presence today</p>
          <p className="font-display text-3xl leading-tight">
            {signals.recognition === undefined ? "–" : `${Math.round(signals.recognition * 100)}`}
            {signals.recognition !== undefined && <span className="text-base text-ink-soft">/100</span>}
          </p>
        </div>
      </div>
      {signals.age && Object.keys(signals.age).length > 0 && (
        <div>
          <p className="mb-2 text-xs text-ink-soft">How each age group likes it, vs. the average adult</p>
          <AgeChart age={signals.age} />
        </div>
      )}
      {signals.cities && signals.cities.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-ink-soft">Rank among {signals.cities[0].of} big cities</p>
          <ul className="flex flex-wrap gap-2">
            {signals.cities.map((c) => (
              <li key={c.name} className="rounded-full bg-paper-sunk px-3 py-1 text-sm">
                {c.name.split(",")[0]} <span className="font-semibold tabular-nums">#{c.rank}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Inspector({ reference }: { reference?: AnalyzedReference }) {
  if (!reference) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-2xl">Pick a reference</p>
        <p className="max-w-xs text-sm text-ink-soft">Click any highlighted name in your script to see how this room reads it.</p>
      </div>
    );
  }

  const { extracted, resolution } = reference;
  const status = resolution.status;

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
        {resolution.standIn && (
          <p className="rounded-md bg-paper-sunk px-2.5 py-1.5 text-xs text-ink-soft">Measured through a stand-in: {resolution.standIn}.</p>
        )}
      </header>

      <Section title="What it does in the line">
        <p className="text-[15px] leading-relaxed">{extracted.role}</p>
      </Section>

      <Section title="How this room reads it">
        {status === "not_checkable" ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Events, memes and trends aren&apos;t in a taste graph, and political figures aren&apos;t measured, so this one is your call.
          </p>
        ) : status === "pending" ? (
          <p className="text-sm leading-relaxed text-ink-soft">Checking with Qloo…</p>
        ) : status === "not_found" ? (
          <p className="text-sm leading-relaxed text-ink-soft">Qloo doesn&apos;t have this one, so it&apos;s your call.</p>
        ) : status === "ambiguous" ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Qloo has several things by this name and none was a clear match:{" "}
            {resolution.candidates?.map((c) => c.name).join(", ")}.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
              {reference.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
            {reference.signals && <SignalsView signals={reference.signals} />}
            <p className="text-[11px] text-ink-faint">All numbers from Qloo&apos;s taste graph, describing audiences in aggregate.</p>
          </div>
        )}
      </Section>

      {(reference.swaps.length > 0 || reference.swapNote) && (
        <Section title="Swaps that do the same job">
          {reference.swaps.length > 0 && (
            <ul className="flex flex-col gap-3">
              {reference.swaps.map((swap) => (
                <li key={swap.entity.id} className="rounded-lg border border-rule bg-paper-raised p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{swap.entity.name}</span>
                    <span className="flex items-center gap-2">
                      {swap.signals.roomIndex !== undefined && (
                        <span className="text-xs tabular-nums text-ink-soft">room {signed(swap.signals.roomIndex)}</span>
                      )}
                      <VerdictChip verdict={swap.verdict} />
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{swap.why}</p>
                  <p className="mt-2 rounded bg-paper-sunk px-2 py-1.5 font-script text-sm leading-relaxed">{swap.rewrite}</p>
                </li>
              ))}
            </ul>
          )}
          {reference.swapNote && <p className="mt-2 text-xs leading-relaxed text-ink-soft">{reference.swapNote}</p>}
        </Section>
      )}
    </div>
  );
}
