// Builds the swap agent's task for one reference in an example script, by
// running the real pipeline (live Qloo). Writes the context to <out.json> and
// prints the task the model would receive.
// Usage: npx tsx --env-file=.env.local scripts/swap-context.ts <sample-id> <room> <reference name> <out.json>
import { writeFile } from "node:fs/promises";
import { SAMPLES } from "../src/content/samples";
import { sentenceAround } from "../src/lib/analysis/references";
import { runAnalysis } from "../src/lib/analysis/run";
import { describeSwapTask } from "../src/lib/analysis/swap-agent";
import type { SwapContext } from "../src/lib/analysis/swap-tools";
import type { Analysis } from "../src/lib/analysis/types";

async function main() {
  const [sampleId, room, refName, out] = process.argv.slice(2);
  const sample = SAMPLES.find((s) => s.id === sampleId);
  if (!sample || !room || !refName || !out) throw new Error("usage: swap-context.ts <sample-id> <room> <reference name> <out.json>");

  let analysis: Analysis | undefined;
  await runAnalysis({ text: sample.text, presetId: room, cities: sample.cities }, (e) => {
    if (e.type === "done") analysis = e.analysis;
  });
  const ref = analysis?.references.find((r) => r.extracted.name === refName);
  if (!analysis || !ref?.resolution.entity) throw new Error(`No measured reference called ${refName}`);
  const span = ref.spans[0];

  const ctx: SwapContext = {
    original: {
      id: ref.resolution.entity.id,
      name: ref.resolution.entity.name,
      type: ref.resolution.entity.type,
      kind: ref.extracted.kind,
      role: ref.extracted.role,
      weight: ref.extracted.weight,
      quotes: ref.extracted.quotes,
      line: sentenceAround(analysis.text, span.start, span.end),
      verdict: ref.verdict,
      reasons: ref.reasons,
    },
    audience: { label: analysis.audience.label, ageMix: analysis.audience.ageMix, cities: analysis.audience.cities },
    checked: {},
  };
  await writeFile(out, JSON.stringify(ctx, null, 2));
  console.log(describeSwapTask(ctx));
}

main();
