import type { AgeMix } from "../audience/audience";
import type { AgeBucket } from "../qloo/api";
import type { ExtractedReference, QuoteSpan } from "./extract";

export type Verdict = "lands" | "risky" | "dead" | "unchecked";

export interface City {
  name: string;
  lat?: number;
  lon?: number;
}

export interface AudienceSpec {
  // A preset id, or "performer" for a room built from a performer's fans.
  presetId: string;
  label: string;
  description: string;
  ageMix: AgeMix;
  cities: City[];
  performer?: EntitySummary;
  // The Qloo entity whose fans the room is (the performer, or a same-name
  // twin that holds their audience data). Steers swaps and local hooks.
  fansOf?: string;
}

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
  description?: string;
  releaseYear?: number;
  popularity?: number;
}

// Every number here comes from Qloo; none is model-generated.
export interface Signals {
  // Popularity percentile within the entity's type (current engagement).
  recognition?: number;
  // How much more (or less) this room likes it than the average adult.
  roomIndex?: number;
  // The same index for each age group.
  age?: Partial<Record<AgeBucket, number>>;
  // Each audience city ranked against a panel of major metros.
  cities?: { name: string; rank: number; of: number }[];
}

// The model's guess about a reference for this room, made before it saw any
// Qloo data, so the two can be shown side by side.
export interface GutCall {
  verdict: Exclude<Verdict, "unchecked">;
  // Same scale as Signals.roomIndex: 0.3 = likes it 30% more than average.
  roomIndex: number;
  fans: AgeBucket;
  reason: string;
}

export interface Swap {
  entity: EntitySummary;
  signals: Signals;
  verdict: Verdict;
  rewrite: string;
  why: string;
}

export type ResolutionStatus = "pending" | "resolved" | "ambiguous" | "not_found" | "not_checkable";

export interface AnalyzedReference {
  key: string;
  extracted: ExtractedReference;
  spans: QuoteSpan[];
  resolution: {
    status: ResolutionStatus;
    entity?: EntitySummary;
    candidates?: EntitySummary[];
    // Set when the measured entity stands in for the reference (the last
    // Blockbuster store for Blockbuster): what it is.
    standIn?: string;
  };
  signals?: Signals;
  gut?: GutCall;
  verdict: Verdict;
  reasons: string[];
  swaps: Swap[];
  // The swap agent's note, e.g. why it found fewer than three substitutes.
  swapNote?: string;
}

// What this room's age group likes in one of the audience's cities.
export interface LocalHooks {
  city: string;
  places: EntitySummary[];
  artists: EntitySummary[];
}

export interface Analysis {
  text: string;
  audience: AudienceSpec;
  references: AnalyzedReference[];
  hooks?: LocalHooks[];
  // Keys of references whose live swap search the client runs next, one
  // request each.
  swapTargets?: string[];
  // "replay" serves a recorded extraction for a built-in example; numbers
  // that need Qloo stay empty rather than being simulated.
  mode: "live" | "replay";
}

export type AnalysisEvent =
  | { type: "status"; message: string }
  | { type: "references"; references: AnalyzedReference[] }
  | { type: "update"; key: string; patch: Partial<AnalyzedReference> }
  | { type: "hooks"; hooks: LocalHooks[] }
  | { type: "done"; analysis: Analysis }
  | { type: "error"; message: string };
