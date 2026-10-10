// The script's references against the tour's cities, shared by the city
// table on screen and the exported notes.
import type { AnalyzedReference } from "@/lib/analysis/types";

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
