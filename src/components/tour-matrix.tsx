"use client";

import { Star } from "lucide-react";
import type { AnalyzedReference } from "@/lib/analysis/types";
import { cityScores, cityTable, verdictIn } from "@/lib/ui/cities";
import { shortCity, VERDICT_LABEL } from "./labels";
import { CardTitle } from "./summary";
import { VerdictIcon } from "./verdict";

const STEPS = 6;

// Rank 1 of N is the darkest step: the city that likes it most.
function step(rank: number, of: number): number {
  const t = of > 1 ? (of - rank) / (of - 1) : 1;
  return Math.min(STEPS, 1 + Math.floor(t * STEPS));
}

interface Props {
  references: AnalyzedReference[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  // The city the script is read for, and a way to read it for another.
  city?: string;
  onPickCity?: (city: string) => void;
}

// Every measured reference against every tour city: where each one plays.
export function TourMatrix({ references, selectedKey, onSelect, city, onPickCity }: Props) {
  const table = cityTable(references);
  if (!table) return null;
  const { cities, rows, panel, typical } = table;
  // The best city is the one where the most should land; ranks break ties.
  const scores = cityScores(references, cities);
  const at = (i: number) => scores[i] ?? -1;
  const best = cities.length > 1 ? cities.reduce((b, _, i) => (at(i) > at(b) || (at(i) === at(b) && typical[i] < typical[b]) ? i : b), 0) : -1;
  const pct = (x: number | undefined) => (x === undefined ? "–" : `${Math.round(x * 100)}%`);

  return (
    <section className="card rounded-2xl p-5 sm:p-6">
      <CardTitle>City by city</CardTitle>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {best >= 0 ? (
              <>
                Strongest stop: <span className="text-accent">{shortCity(cities[best])}</span>
                <span className="text-ink-faint"> · {pct(scores[best])} should land</span>
              </>
            ) : (
              <>How {shortCity(cities[0])} ranks for each reference</>
            )}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Where each reference is liked most by people in general, ranked among {panel} big US metros (#1 likes it most). In a
            city&apos;s top three it plays one step better there; near the bottom, one step worse.
            {onPickCity && cities.length > 1 && " Pick a city to read the script for it."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-faint" aria-hidden>
          <span>Likes it less</span>
          <span className="flex gap-[2px]">
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className="h-3 w-5 first:rounded-l-[4px] last:rounded-r-[4px]" style={{ background: `var(--seq-${i + 1})` }} />
            ))}
          </span>
          <span>more</span>
        </div>
      </div>

      <div className="scrollbar-none mt-5 overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-sm">
          <thead>
            <tr>
              <th className="min-w-[11rem] text-left text-[11px] font-medium text-ink-faint">
                <span className="sr-only">Reference</span>
              </th>
              {cities.map((c, i) => (
                <th key={c} scope="col" title={c} className="w-[6.5rem] min-w-[4.5rem] px-0.5 pb-1 text-center text-xs font-medium">
                  {onPickCity && cities.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onPickCity(c)}
                      aria-pressed={c === city}
                      className={`inline-flex w-full items-center justify-center gap-1 rounded-md px-1.5 py-1 ${c === city ? "bg-ink text-bg" : "hover:bg-sunk"}`}
                    >
                      {i === best && <Star className="size-3 fill-accent-glow text-accent-glow" aria-label="Best fit" />}
                      {shortCity(c)}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {i === best && <Star className="size-3 fill-accent-glow text-accent-glow" aria-label="Best fit" />}
                      {shortCity(c)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="group">
                <th scope="row" className="pr-2 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onSelect(r.key)}
                    className={`flex w-full max-w-[18rem] items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-sunk ${
                      selectedKey === r.key ? "bg-sunk font-medium" : ""
                    }`}
                  >
                    <VerdictIcon verdict={r.verdict} className="size-3.5 shrink-0" />
                    <span className="truncate">{r.extracted.name}</span>
                  </button>
                </th>
                {cities.map((city) => {
                  const c = r.signals!.cities!.find((x) => x.name === city);
                  if (!c) {
                    return (
                      <td key={city} className="rounded-[4px] bg-sunk text-center text-xs text-ink-faint">
                        –
                      </td>
                    );
                  }
                  const s = step(c.rank, c.of);
                  const v = verdictIn(r, city);
                  const tip = `${r.extracted.name}: #${c.rank} of ${c.of} cities in ${shortCity(city)}, ${VERDICT_LABEL[v].toLowerCase()} there`;
                  return (
                    <td
                      key={city}
                      tabIndex={0}
                      aria-label={tip}
                      className="group/cell relative h-8 rounded-[4px] text-center text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      style={{ background: `var(--seq-${s})`, color: `var(--seq-ink-${s})` }}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span className="grid size-4 place-items-center rounded-full bg-bg/90">
                          <VerdictIcon verdict={v} className="size-2.5" />
                        </span>
                        #{c.rank}
                      </span>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-normal text-bg shadow-lg group-hover/cell:block group-focus-visible/cell:block"
                      >
                        {tip}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {cities.length > 1 && (
            <tfoot>
              <tr>
                <th scope="row" className="px-1.5 pt-2 text-left text-xs font-medium text-ink-soft">
                  Should land
                </th>
                {cities.map((city, i) => (
                  <td key={city} className={`pt-2 text-center text-xs tabular-nums ${i === best ? "font-semibold text-ink" : "text-ink-soft"}`}>
                    {pct(scores[i])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
