"use client";

import { ArrowRight, Check, ChevronDown, LoaderCircle, MapPin } from "lucide-react";
import type { AgeMix } from "@/lib/audience/audience";
import type { AnalyzedReference, Verdict } from "@/lib/analysis/types";
import { VERDICT_LABEL } from "./labels";
import { EntityThumb } from "./entity-thumb";
import { AgeHistogram } from "./room-picker";
import { VerdictIcon } from "./verdict";

export const VERDICT_ORDER: Verdict[] = ["lands", "risky", "dead", "unchecked"];

const BAR: Record<Verdict, string> = { lands: "bg-lands", risky: "bg-risky", dead: "bg-dead", unchecked: "bg-quiet/40" };

export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{children}</h2>
      {right}
    </div>
  );
}

interface ScoreProps {
  score?: number;
  projected?: number;
  counts: Record<Verdict, number>;
  progress?: { done: number; total: number };
  onJump: (verdict: Verdict) => void;
}

export function ScoreCard({ score, projected, counts, progress, onJump }: ScoreProps) {
  const total = VERDICT_ORDER.reduce((sum, v) => sum + counts[v], 0);
  const pct = (x: number) => Math.round(x * 100);
  const improved = projected !== undefined && score !== undefined && pct(projected) !== pct(score);
  return (
    <section className="card rounded-2xl p-5">
      <CardTitle
        right={
          progress && progress.done < progress.total ? (
            <span className="flex items-center gap-1 text-[11px] text-ink-faint">
              <LoaderCircle className="size-3 animate-spin" aria-hidden />
              {progress.done}/{progress.total}
            </span>
          ) : undefined
        }
      >
        Room read
      </CardTitle>
      <div className="flex items-end gap-3">
        <p className="text-5xl font-semibold leading-none tracking-tight" aria-live="polite">
          {score === undefined ? "–" : pct(improved ? projected! : score)}
          <span className="text-2xl text-ink-faint">%</span>
        </p>
        {improved && (
          <p className="mb-1 flex items-center gap-1 text-xs text-ink-faint">
            <span className="line-through">{pct(score!)}%</span>
            <span className="font-medium text-lands-ink">with your swaps</span>
          </p>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-ink-soft" title="Lands counts fully, risky half; punchlines weigh 3, setups 2, color 1.">
        of what the script leans on should land, weighted toward punchlines
      </p>
      {total > 0 && (
        <div className="mt-4 flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
          {VERDICT_ORDER.filter((v) => counts[v] > 0).map((v) => (
            <span key={v} className={`${BAR[v]} transition-[flex-grow] duration-500`} style={{ flexGrow: counts[v] }} />
          ))}
        </div>
      )}
      <ul className="mt-3 flex flex-col">
        {VERDICT_ORDER.map((v) => (
          <li key={v}>
            <button
              type="button"
              onClick={() => onJump(v)}
              disabled={counts[v] === 0}
              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sunk disabled:pointer-events-none disabled:opacity-45"
            >
              <VerdictIcon verdict={v} />
              <span className={v === "unchecked" ? "text-ink-soft" : ""}>{VERDICT_LABEL[v]}</span>
              <span className="ml-auto font-semibold tabular-nums">{counts[v]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface FixesProps {
  references: AnalyzedReference[];
  accepted: Record<string, number>;
  selectedKey?: string;
  onSelect: (key: string) => void;
}

// Every weak reference that has a swap, and whether the performer took it.
export function FixesCard({ references, accepted, selectedKey, onSelect }: FixesProps) {
  const fixable = references.filter((r) => r.swaps.length > 0);
  if (!fixable.length) return null;
  const taken = fixable.filter((r) => accepted[r.key] !== undefined).length;
  return (
    <section className="card rounded-2xl p-5">
      <CardTitle right={<span className="text-[11px] tabular-nums text-ink-faint">{taken}/{fixable.length} used</span>}>Swaps</CardTitle>
      <ul className="-mx-2 flex flex-col">
        {fixable.map((r) => {
          const pick = accepted[r.key];
          const swap = r.swaps[pick ?? 0];
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onSelect(r.key)}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-sunk ${
                  selectedKey === r.key ? "bg-sunk" : ""
                }`}
              >
                <span className="mt-[3px]">
                  {pick !== undefined ? (
                    <Check className="size-3.5 shrink-0 text-lands" strokeWidth={2.75} aria-label="Swap used" />
                  ) : (
                    <VerdictIcon verdict={r.verdict} className="size-3.5 shrink-0" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${pick !== undefined ? "text-ink-faint line-through" : ""}`}>{r.extracted.name}</span>
                  <span className={`flex items-center gap-1 text-xs ${pick !== undefined ? "font-medium text-ink" : "text-ink-soft"}`}>
                    <ArrowRight className="size-3 shrink-0 text-ink-faint" aria-hidden />
                    <span className="truncate">{swap.entity.name}</span>
                    {pick === undefined && r.swaps.length > 1 && <span className="shrink-0 text-ink-faint">+{r.swaps.length - 1}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A room as the results show it: a preset, or a performer's fans.
export interface RoomInfo {
  label: string;
  description: string;
  ageMix: AgeMix;
  // How sentences refer to the people in it ("college crowd audiences",
  // "fans of Cedric the Entertainer").
  audience: string;
  imageUrl?: string;
  name?: string;
}

export function RoomCard({ room, cities }: { room: RoomInfo; cities: string[] }) {
  return (
    <section className="card rounded-2xl p-5">
      <CardTitle>The room</CardTitle>
      <div className="flex items-start gap-3">
        {room.name && <EntityThumb src={room.imageUrl} name={room.name} className="size-10" />}
        <div className="min-w-0">
          <p className="font-medium leading-tight">{room.label}</p>
          <p className="mt-0.5 text-xs text-ink-faint">{room.description}</p>
        </div>
      </div>
      <div className="mt-3">
        <AgeHistogram mix={room.ageMix} className="h-12" labels />
      </div>
      {cities.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          {cities.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <MapPin className="size-3.5 text-ink-faint" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AgentTrace({ statuses, running }: { statuses: string[]; running: boolean }) {
  return (
    <details open className="card group rounded-2xl p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">Agent log</h2>
        <span className="flex items-center gap-1 text-[11px] text-ink-faint">
          {statuses.length} steps
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <ol className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto font-mono text-[11.5px] leading-snug" aria-live="polite" aria-label="What the agent is doing">
        {statuses.map((s, i) => {
          const current = running && i === statuses.length - 1;
          return (
            <li key={i} className={`flex gap-2 ${current ? "text-ink" : "text-ink-soft"}`}>
              <span className="mt-1 grid size-2.5 shrink-0 place-items-center">
                {current ? (
                  <LoaderCircle className="size-2.5 animate-spin text-accent" aria-hidden />
                ) : (
                  <span className="size-1.5 rounded-full bg-ink-faint/60" aria-hidden />
                )}
              </span>
              {s}
            </li>
          );
        })}
        {running && statuses.length === 0 && <li className="text-ink">Starting…</li>}
      </ol>
    </details>
  );
}
