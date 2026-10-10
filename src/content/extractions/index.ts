// Recorded extractions of the built-in example scripts (model output on our
// own text, no Qloo data). They let the examples run without an LLM call.
import { z } from "zod";
import { ExtractedReferenceSchema, type Extraction } from "@/lib/analysis/extract";

// Recorded examples also say which references are facts that can't be swapped.
const RecordedSchema = z.object({ references: z.array(ExtractedReferenceSchema.extend({ swappable: z.boolean().optional() })) });
import datingSet from "./01-dating-set.json";
import keynote from "./02-keynote.json";
import bestMan from "./03-best-man.json";
import lecture from "./04-lecture.json";
import roast from "./05-presidential-roast.json";
import oneLiners from "./06-one-liners.json";

export const RECORDED_EXTRACTIONS: Record<string, Extraction> = {
  "01-dating-set": RecordedSchema.parse(datingSet),
  "02-keynote": RecordedSchema.parse(keynote),
  "03-best-man": RecordedSchema.parse(bestMan),
  "04-lecture": RecordedSchema.parse(lecture),
  "05-presidential-roast": RecordedSchema.parse(roast),
  "06-one-liners": RecordedSchema.parse(oneLiners),
};
