import Anthropic from "@anthropic-ai/sdk";
import { RECORDED_EXTRACTIONS } from "@/content/extractions";
import { SAMPLES } from "@/content/samples";
import { AUDIENCE_PRESETS, presetById } from "../audience/audience";
import { findCity } from "../geo/cities";
import { extractReferences, type Extraction } from "./extract";
import { buildReferences } from "./references";
import type { AnalysisEvent, AudienceSpec } from "./types";

export interface AnalysisInput {
  text: string;
  presetId: string;
  cities: string[];
}

// Errors whose message is safe and useful to show the user as-is.
export class UserFacingError extends Error {}

const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();

export async function runAnalysis(input: AnalysisInput, send: (event: AnalysisEvent) => void) {
  const text = normalize(input.text);
  const preset = presetById(input.presetId) ?? AUDIENCE_PRESETS[0];
  const cities = input.cities.map((name) => ({ name, match: findCity(name) }));
  const unknown = cities.filter((c) => !c.match).map((c) => c.name);
  if (unknown.length) {
    send({ type: "status", message: `Couldn't place ${unknown.join(", ")} on the map; city checks will skip ${unknown.length > 1 ? "them" : "it"}` });
  }
  const audience: AudienceSpec = {
    presetId: preset.id,
    label: preset.label,
    ageMix: preset.ageMix,
    cities: cities.map(({ name, match }) => (match ? { name: match.label, lat: match.lat, lon: match.lon } : { name })),
  };

  const sample = SAMPLES.find((s) => normalize(s.text) === text);
  let extraction: Extraction;
  let mode: "live" | "replay";
  if (sample && RECORDED_EXTRACTIONS[sample.id]) {
    send({ type: "status", message: "Reading the script (recorded example)" });
    extraction = RECORDED_EXTRACTIONS[sample.id];
    mode = "replay";
  } else if (process.env.ANTHROPIC_API_KEY) {
    send({ type: "status", message: "Reading the script" });
    extraction = await extractReferences(new Anthropic(), text);
    mode = "live";
  } else {
    throw new UserFacingError("Live analysis isn't switched on yet. Try one of the examples.");
  }

  const references = buildReferences(text, extraction);
  send({ type: "references", references });
  const checkable = references.filter((r) => r.resolution.status !== "not_checkable").length;
  send({
    type: "status",
    message: `Found ${references.length} references, ${checkable} of them checkable against Qloo`,
  });

  send({ type: "done", analysis: { text, audience, references, mode } });
}
