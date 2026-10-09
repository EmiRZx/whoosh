// Lines up the model's blind gut calls with what Qloo measured.

import type { AnalyzedReference, GutCall, Verdict } from "@/lib/analysis/types";
import { AGE_BUCKETS, type AgeBucket } from "@/lib/qloo/api";

// The age group that over-indexes most, by Qloo's age index.
export function topBucket(age?: Partial<Record<AgeBucket, number>>): AgeBucket | undefined {
  let best: AgeBucket | undefined;
  for (const b of AGE_BUCKETS) {
    const v = age?.[b];
    if (v !== undefined && (best === undefined || v > age![best]!)) best = b;
  }
  return best;
}

export interface GutRow {
  key: string;
  name: string;
  gut: GutCall;
  verdict: Verdict;
  roomIndex?: number;
  fans?: AgeBucket;
  same: boolean;
  // How far the guessed room index was from the measured one.
  gap?: number;
}

// Every measured reference that also has a gut call, biggest misses first.
export function gutRows(references: AnalyzedReference[]): GutRow[] {
  return references
    .filter((r) => r.gut && r.verdict !== "unchecked")
    .map((r) => {
      const roomIndex = r.signals?.roomIndex;
      return {
        key: r.key,
        name: r.extracted.name,
        gut: r.gut!,
        verdict: r.verdict,
        roomIndex,
        fans: topBucket(r.signals?.age),
        same: r.gut!.verdict === r.verdict,
        gap: roomIndex === undefined ? undefined : Math.abs(r.gut!.roomIndex - roomIndex),
      };
    })
    .sort((a, b) => Number(a.same) - Number(b.same) || (b.gap ?? -1) - (a.gap ?? -1));
}
