"use client";

import { Star } from "lucide-react";
import type { AnalyzedReference } from "@/lib/analysis/types";
import { shortCity } from "./labels";
import { CardTitle } from "./summary";
import { VerdictIcon } from "./verdict";

const STEPS = 6;

// Rank 1 of N is the darkest step: the city that likes it most.
function step(rank: number, of: number): number {
  const t = of > 1 ? (of - rank) / (of - 1) : 1;
  return Math.min(STEPS, 1 + Math.floor(t * STEPS));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

interface Props {
  references: AnalyzedReference[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}

// Every measured reference against every tour city: where each one plays.
export function TourMatrix({ references, selectedKey, onSelect }: Props) {
  const rows = references.filter((r) => r.signals?.cities?.length);
  const cities: string[] = [];
  for (const r of rows) for (const c of r.signals!.cities!) if (!cities.includes(c.name)) cities.push(c.name);
  if (!rows.length || !cities.length) return null;

  // A city's typical standing across the script, as a share of the panel (0 = top).
  const standing = cities.map((city) => {
    const shares = rows.flatMap((r) => {
      const c = r.signals!.cities!.find((x) => x.name === city);
      return c ? [(c.rank - 1) / Math.max(1, c.of - 1)] : [];
    });
    return shares.length ? median(shares) : 1;
  });
  const best = cities.length > 1 ? standing.indexOf(Math.min(...standing)) : -1;
  const panel = rows[0].signals!.cities![0].of;

  return (
    <section className="card rounded-2xl p-5 sm:p-6">
      <CardTitle>City by city</CardTitle>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {best >= 0 ? (
              <>
                Strongest stop: <span className="text-accent">{shortCity(cities[best])}</span>
              </>
            ) : (
              <>How {shortCity(cities[0])} ranks for each reference</>
            )}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Each reference ranked among about {panel} big cities by how much people there like it. #1 is the city that likes it most.
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
              {cities.map((city, i) => (
                <th key={city} scope="col" title={city} className="w-[6.5rem] min-w-[4.5rem] px-1 pb-1 text-center text-xs font-medium">
                  <span className="inline-flex items-center gap-1">
                    {i === best && <Star className="size-3 fill-accent-glow text-accent-glow" aria-label="Best fit" />}
                    {shortCity(city)}
                  </span>
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
                  const tip = `${r.extracted.name}: #${c.rank} of ${c.of} cities in ${city}`;
                  return (
                    <td
                      key={city}
                      tabIndex={0}
                      aria-label={tip}
                      className="group/cell relative h-8 rounded-[4px] text-center text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      style={{ background: `var(--seq-${s})`, color: `var(--seq-ink-${s})` }}
                    >
                      #{c.rank}
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
                  Typical rank
                </th>
                {cities.map((city, i) => (
                  <td key={city} className={`pt-2 text-center text-xs tabular-nums ${i === best ? "font-semibold text-ink" : "text-ink-soft"}`}>
                    #{Math.round(standing[i] * (panel - 1)) + 1}
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
