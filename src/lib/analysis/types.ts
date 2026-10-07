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
  presetId: string;
  label: string;
  ageMix: AgeMix;
  cities: City[];
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
  recognition?: number;
  roomIndex?: number;
  age?: Partial<Record<AgeBucket, number>>;
  cities?: { name: string; affinity: number }[];
  momentum?: "rising" | "steady" | "fading";
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
  resolution: { status: ResolutionStatus; entity?: EntitySummary; candidates?: EntitySummary[] };
  signals?: Signals;
  verdict: Verdict;
  reasons: string[];
  swaps: Swap[];
}

export interface Analysis {
  text: string;
  audience: AudienceSpec;
  references: AnalyzedReference[];
  // "replay" serves a recorded extraction for a built-in example; numbers
  // that need Qloo stay empty rather than being simulated.
  mode: "live" | "replay";
}

export type AnalysisEvent =
  | { type: "status"; message: string }
  | { type: "references"; references: AnalyzedReference[] }
  | { type: "update"; key: string; patch: Partial<AnalyzedReference> }
  | { type: "done"; analysis: Analysis }
  | { type: "error"; message: string };
