"use client";

import { ArrowRight } from "lucide-react";
import type { AnalyzedReference } from "@/lib/analysis/types";
import { gutRows } from "@/lib/ui/gut";
import { signed } from "./labels";
import { CardTitle } from "./summary";
import { VerdictIcon } from "./verdict";

interface Props {
  references: AnalyzedReference[];
  room: string;
  selectedKey?: string;
  onSelect: (key: string) => void;
}

const GutMark = () => <span className="block size-2.5 rounded-full border-2 border-ink-soft bg-bg" aria-hidden />;
const DataMark = () => <span className="block size-2.5 rounded-full bg-more ring-2 ring-bg" aria-hidden />;

// Each reference on one axis (how much this room likes it vs. the average
// adult): the model's blind guess and Qloo's measurement, joined by a line.
export function GutVsData({ references, room, selectedKey, onSelect }: Props) {
  const rows = gutRows(references);
  if (!rows.length) return null;
  const same = rows.filter((r) => r.same).length;
  const measured = rows.filter((r) => r.roomIndex !== undefined);
  const direction = measured.filter((r) => Math.sign(r.gut.roomIndex) === Math.sign(r.roomIndex!)).length;
  const gap = measured.length ? measured.reduce((sum, r) => sum + r.gap!, 0) / measured.length : undefined;

  const extent = Math.max(0.5, ...rows.flatMap((r) => [Math.abs(r.gut.roomIndex), Math.abs(r.roomIndex ?? 0)]));
  const domain = Math.min(2, Math.ceil(extent * 2) / 2);
  const x = (v: number) => `${((Math.max(-domain, Math.min(domain, v)) + domain) / (2 * domain)) * 100}%`;

  return (
    <section className="card rounded-2xl p-5 sm:p-6">
      <CardTitle>Gut vs. data</CardTitle>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Claude&apos;s gut matched the data on {same} of {rows.length} calls
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Before seeing any numbers, Claude guessed how the {room.toLowerCase()} would take each reference. Then Qloo measured it.
            Disagreements first.
          </p>
          {measured.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-2 text-xs">
              <div className="rounded-full bg-sunk px-3 py-1">
                <dt className="inline text-ink-soft">Same call </dt>
                <dd className="inline font-semibold tabular-nums">
                  {same}/{rows.length}
                </dd>
              </div>
              <div className="rounded-full bg-sunk px-3 py-1">
                <dt className="inline text-ink-soft">Right direction vs. average </dt>
                <dd className="inline font-semibold tabular-nums">
                  {direction}/{measured.length}
                </dd>
              </div>
              {gap !== undefined && (
                <div className="rounded-full bg-sunk px-3 py-1">
                  <dt className="inline text-ink-soft">Off by </dt>
                  <dd className="inline font-semibold tabular-nums">{Math.round(gap * 100)} points on average</dd>
                </div>
              )}
            </dl>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <GutMark />
            Claude&apos;s guess
          </span>
          <span className="flex items-center gap-1.5">
            <DataMark />
            Qloo
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_5.5rem]">
        <span />
        <div className="relative mb-1 h-4 text-[10px] text-ink-faint">
          <span className="absolute left-0">{signed(-domain)}</span>
          <span className="absolute left-1/2 -translate-x-1/2">average adult</span>
          <span className="absolute right-0">{signed(domain)}</span>
        </div>
        <span className="hidden sm:block" />

        {rows.map((r) => {
          const lo = Math.min(r.gut.roomIndex, r.roomIndex ?? r.gut.roomIndex);
          const hi = Math.max(r.gut.roomIndex, r.roomIndex ?? r.gut.roomIndex);
          const tip = `Guess: ${signed(r.gut.roomIndex)}, ${r.gut.verdict === "dead" ? "won't land" : r.gut.verdict} · Qloo: ${
            r.roomIndex === undefined ? "no room index" : signed(r.roomIndex)
          }, ${r.verdict === "dead" ? "won't land" : r.verdict}`;
          return (
            <div key={r.key} className="contents">
              <button
                type="button"
                onClick={() => onSelect(r.key)}
                className={`flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-sunk ${
                  selectedKey === r.key ? "bg-sunk font-medium" : ""
                }`}
              >
                <span className="truncate">{r.name}</span>
                {!r.same && <span className="size-1.5 shrink-0 rounded-full bg-accent-glow" aria-label="Disagreement" />}
              </button>
              <div
                tabIndex={0}
                aria-label={`${r.name}. ${tip}`}
                className="group relative h-full min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="absolute inset-y-1 left-1/2 border-l border-dashed border-line" aria-hidden />
                <span className="absolute left-0 right-0 top-1/2 h-px bg-line" aria-hidden />
                {r.roomIndex !== undefined && (
                  <span
                    className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink-faint/50"
                    style={{ left: x(lo), right: `calc(100% - ${x(hi)})` }}
                    aria-hidden
                  />
                )}
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: x(r.gut.roomIndex) }}>
                  <GutMark />
                </span>
                {r.roomIndex !== undefined && (
                  <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: x(r.roomIndex) }}>
                    <DataMark />
                  </span>
                )}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-bg shadow-lg group-hover:block group-focus-visible:block"
                >
                  {tip}
                </span>
              </div>
              <span className="col-start-2 flex items-center gap-1 pb-1 text-[11px] text-ink-faint sm:col-start-auto sm:justify-end sm:pb-0">
                <VerdictIcon verdict={r.gut.verdict} className="size-3" />
                <ArrowRight className="size-3" aria-hidden />
                <VerdictIcon verdict={r.verdict} className="size-3" />
                <span className="sr-only">
                  Guessed {r.gut.verdict}, measured {r.verdict}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
