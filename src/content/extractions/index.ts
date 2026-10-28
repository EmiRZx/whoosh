// Recorded model output for the built-in example scripts, so the examples run
// without an LLM call: the extraction (<id>.json, model output on our own
// text, no Qloo data) and, in <id>.replay.json, which Qloo entry each
// ambiguous reference means, the blind gut call per room, and the swap
// agent's picks and rewrites. Everything is stored by name and type, never as
// Qloo data: at runtime the names are looked up and measured again.
// scripts/record-example.ts writes these files.
import { z } from "zod";
import { ExtractedReferenceSchema, type Extraction } from "@/lib/analysis/extract";
import type { RawGutCall } from "@/lib/analysis/gut";
import datingSet from "./01-dating-set.json";
import datingSetReplay from "./01-dating-set.replay.json";
import keynote from "./02-keynote.json";
import keynoteReplay from "./02-keynote.replay.json";
import bestMan from "./03-best-man.json";
import bestManReplay from "./03-best-man.replay.json";
import lecture from "./04-lecture.json";
import lectureReplay from "./04-lecture.replay.json";
import roast from "./05-presidential-roast.json";
import roastReplay from "./05-presidential-roast.replay.json";
import oneLiners from "./06-one-liners.json";
import oneLinersReplay from "./06-one-liners.replay.json";
import cedric from "./07-cedric-opener.json";
import cedricReplay from "./07-cedric-opener.replay.json";

// Recorded examples also say which references are facts that can't be swapped.
const RecordedSchema = z.object({ references: z.array(ExtractedReferenceSchema.extend({ swappable: z.boolean().optional() })) });

export interface RecordedPick {
  name: string;
  type: string;
  // Tells apart same-named entries (three shows called "CBS Mornings").
  year?: number;
  standIn?: string;
}

export interface RecordedSwap {
  name: string;
  type: string;
  // Tells apart same-named entries (several films called "Hamilton").
  year?: number;
  rewrite: string;
  why: string;
}

export interface Replay {
  // null: none of the candidates is the thing the speaker meant.
  picks: Record<string, RecordedPick | null>;
  // Room preset (or "performer") -> reference name -> the gut call.
  gut: Record<string, Record<string, Omit<RawGutCall, "id">>>;
  swaps: Record<string, { swaps: RecordedSwap[]; note: string }>;
}

const RECORDED: Record<string, { extraction: unknown; replay: unknown }> = {
  "01-dating-set": { extraction: datingSet, replay: datingSetReplay },
  "02-keynote": { extraction: keynote, replay: keynoteReplay },
  "03-best-man": { extraction: bestMan, replay: bestManReplay },
  "04-lecture": { extraction: lecture, replay: lectureReplay },
  "05-presidential-roast": { extraction: roast, replay: roastReplay },
  "06-one-liners": { extraction: oneLiners, replay: oneLinersReplay },
  "07-cedric-opener": { extraction: cedric, replay: cedricReplay },
};

const each = <T>(pick: (r: { extraction: unknown; replay: unknown }) => T) =>
  Object.fromEntries(Object.entries(RECORDED).map(([id, r]) => [id, pick(r)])) as Record<string, T>;

export const RECORDED_EXTRACTIONS: Record<string, Extraction> = each((r) => RecordedSchema.parse(r.extraction));
const replays = each((r) => r.replay as Replay);
export const RECORDED_PICKS = each((r) => (r.replay as Replay).picks);
export const RECORDED_GUT = each((r) => (r.replay as Replay).gut);
export const RECORDED_SWAPS = each((r) => (r.replay as Replay).swaps);
export const replayFor = (id: string): Replay | undefined => replays[id];
