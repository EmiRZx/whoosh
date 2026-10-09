// Recorded extractions of the built-in example scripts (model output on our
// own text, no Qloo data). They let the examples run without an LLM call.
import { ExtractionSchema, type Extraction } from "@/lib/analysis/extract";
import datingSet from "./01-dating-set.json";
import keynote from "./02-keynote.json";
import bestMan from "./03-best-man.json";
import lecture from "./04-lecture.json";
import roast from "./05-presidential-roast.json";
import oneLiners from "./06-one-liners.json";

export const RECORDED_EXTRACTIONS: Record<string, Extraction> = {
  "01-dating-set": ExtractionSchema.parse(datingSet),
  "02-keynote": ExtractionSchema.parse(keynote),
  "03-best-man": ExtractionSchema.parse(bestMan),
  "04-lecture": ExtractionSchema.parse(lecture),
  "05-presidential-roast": ExtractionSchema.parse(roast),
  "06-one-liners": ExtractionSchema.parse(oneLiners),
};
