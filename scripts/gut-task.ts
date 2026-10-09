// Prints the gut-call prompt for an example script, so a model run outside the
// app can produce the recorded calls in src/content/extractions/gut.ts.
// Usage: npx tsx scripts/gut-task.ts <sample-id> [preset-id]
import { RECORDED_EXTRACTIONS } from "../src/content/extractions";
import { SAMPLES } from "../src/content/samples";
import { describeGutTask, GUT_SYSTEM_PROMPT } from "../src/lib/analysis/gut";
import { buildReferences } from "../src/lib/analysis/references";
import { presetById } from "../src/lib/audience/audience";

const [sampleId, presetArg] = process.argv.slice(2);
const sample = SAMPLES.find((s) => s.id === sampleId);
if (!sample) throw new Error(`Unknown sample ${sampleId}`);
const preset = presetById(presetArg ?? sample.presetId);
if (!preset) throw new Error(`Unknown preset ${presetArg}`);
const text = sample.text.replace(/\r\n/g, "\n").trim();
const refs = buildReferences(text, RECORDED_EXTRACTIONS[sample.id]).filter((r) => r.resolution.status === "pending");
const task = describeGutTask(
  text,
  { label: preset.label, ageMix: preset.ageMix },
  preset.description,
  refs.map((r) => ({ id: r.key, reference: r.extracted })),
);
console.log(`<system>\n${GUT_SYSTEM_PROMPT}\n</system>\n\n<user>\n${task}\n</user>`);
