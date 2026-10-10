// A mixed room (a wedding, a company party) can love a reference at one end
// and not know it at the other; one averaged number hides that. This splits
// the room into generations and says how each one feels.
import type { AgeMix } from "@/lib/audience/audience";
import type { AgeBucket } from "@/lib/qloo/api";

const GROUPS: { label: string; buckets: AgeBucket[] }[] = [
  { label: "Under 30", buckets: ["24_and_younger", "25_to_29"] },
  { label: "30–54", buckets: ["30_to_34", "35_to_44", "45_to_54"] },
  { label: "55+", buckets: ["55_and_older"] },
];

// A generation this large is a real part of the room.
const MIN_SHARE = 0.15;

export interface Generation {
  label: string;
  share: number;
  index: number;
  feeling: "big fans" | "like it" | "about average" | "lukewarm" | "cool";
}

const feeling = (x: number): Generation["feeling"] =>
  x >= 0.25 ? "big fans" : x >= 0.05 ? "like it" : x > -0.05 ? "about average" : x > -0.25 ? "lukewarm" : "cool";

// Empty unless at least two generations each make up a real part of the room.
export function generations(age: Partial<Record<AgeBucket, number>>, mix: AgeMix): Generation[] {
  const out: Generation[] = [];
  for (const g of GROUPS) {
    const share = g.buckets.reduce((s, b) => s + mix[b], 0);
    const known = g.buckets.filter((b) => age[b] !== undefined);
    if (share < MIN_SHARE || !known.length) continue;
    const weight = known.reduce((s, b) => s + mix[b], 0);
    const index = weight > 0 ? known.reduce((s, b) => s + age[b]! * mix[b], 0) / weight : known.reduce((s, b) => s + age[b]!, 0) / known.length;
    out.push({ label: g.label, share, index, feeling: feeling(index) });
  }
  return out.length >= 2 ? out : [];
}
