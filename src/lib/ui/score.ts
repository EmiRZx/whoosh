// One number for "how will this read in the room": the share of checked
// references that land, weighted by how much the joke leans on each.

import type { ExtractedReference } from "@/lib/analysis/extract";
import type { Verdict } from "@/lib/analysis/types";

// A dead punchline costs more than a dead aside.
export const ROLE_WEIGHT: Record<ExtractedReference["weight"], number> = { punchline: 3, setup: 2, color: 1 };
// Risky references count half: some of the room will get them.
const VERDICT_VALUE: Partial<Record<Verdict, number>> = { lands: 1, risky: 0.5, dead: 0 };

export interface Scored {
  verdict: Verdict;
  weight: ExtractedReference["weight"];
}

// Undefined until at least one reference has been measured.
export function roomScore(items: Scored[]): number | undefined {
  let total = 0;
  let earned = 0;
  for (const item of items) {
    const value = VERDICT_VALUE[item.verdict];
    if (value === undefined) continue;
    total += ROLE_WEIGHT[item.weight];
    earned += ROLE_WEIGHT[item.weight] * value;
  }
  return total > 0 ? earned / total : undefined;
}

// A script that leans on few named references. The examples carry 9 to 19 per
// thousand characters and real sets 2 to 4, but a real set runs long enough to
// have a dozen; a short observational bit has a handful at most.
export function lightOnReferences(count: number, text: string): boolean {
  return count === 0 || (count <= 4 && count * 1000 < 5 * text.length);
}
