// Recorded swap-agent output for the example scripts: which substitutes it
// chose and how it rewrote each line. Stored by name and type, not Qloo data;
// at runtime each substitute is looked up and checked against the room again,
// and dropped if it no longer lands.
export interface RecordedSwap {
  name: string;
  type: string;
  rewrite: string;
  why: string;
}

export const RECORDED_SWAPS: Record<string, Record<string, { swaps: RecordedSwap[]; note: string }>> = {};
