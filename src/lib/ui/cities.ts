// The script's references against the tour's cities, shared by the city
// table on screen and the exported notes.
import type { AnalyzedReference, Verdict } from "@/lib/analysis/types";
import { roomScore } from "./score";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export interface CityTable {
  cities: string[];
  rows: AnalyzedReference[];
  // Size of the ranking panel (#1 of `panel`).
  panel: number;
  // Each city's typical rank across the script.
  typical: number[];
  // Index of the city where the script plays best, or -1 with one city.
  best: number;
  rank: (ref: AnalyzedReference, city: string) => { rank: number; of: number } | undefined;
}

export function cityTable(references: AnalyzedReference[]): CityTable | undefined {
  const rows = references.filter((r) => r.signals?.cities?.length);
  const cities: string[] = [];
  for (const r of rows) for (const c of r.signals!.cities!) if (!cities.includes(c.name)) cities.push(c.name);
  if (!rows.length || !cities.length) return undefined;
  const panel = rows[0].signals!.cities![0].of;
  const rank = (ref: AnalyzedReference, city: string) => ref.signals?.cities?.find((x) => x.name === city);

  // A city's typical standing across the script, as a share of the panel (0 = top).
  const standing = cities.map((city) => {
    const shares = rows.flatMap((r) => {
      const c = rank(r, city);
      return c ? [(c.rank - 1) / Math.max(1, c.of - 1)] : [];
    });
    return shares.length ? median(shares) : 1;
  });
  const best = cities.length > 1 ? standing.indexOf(Math.min(...standing)) : -1;
  return { cities, rows, panel, typical: standing.map((s) => Math.round(s * (panel - 1)) + 1), best, rank };
}

// A reference's verdict in one city of the tour (the room's verdict when
// Qloo couldn't rank it there).
export function verdictIn(ref: Pick<AnalyzedReference, "verdict" | "cityVerdicts">, city: string | undefined): Verdict {
  return (city && ref.cityVerdicts?.[city]) || ref.verdict;
}

// The script read for one city: every reference takes its verdict there.
export function readFor<T extends Pick<AnalyzedReference, "verdict" | "cityVerdicts">>(refs: T[], city: string | undefined): T[] {
  if (!city) return refs;
  return refs.map((r) => {
    const v = verdictIn(r, city);
    return v === r.verdict ? r : { ...r, verdict: v };
  });
}

// The room score in each city of the tour.
export function cityScores(refs: AnalyzedReference[], cities: string[]): (number | undefined)[] {
  return cities.map((city) => roomScore(refs.map((r) => ({ verdict: verdictIn(r, city), weight: r.extracted.weight }))));
}
