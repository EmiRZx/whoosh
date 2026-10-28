// Runs live reference extraction on every gold-set text (evals/extraction/texts.json,
// the example scripts as the gold set was written for them) and writes one JSON
// per sample, for score.ts. Uses the configured model (LLM_MODEL) and key.
// Usage: npx tsx evals/extraction/run.ts <out-dir> [effort]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import TEXTS from "./texts.json";
import type { Effort } from "../../src/lib/llm/config";

async function main() {
  loadEnvConfig(process.cwd());
  // Imported after the env is loaded: the model id is read at import time.
  const { extractReferences } = await import("../../src/lib/analysis/extract");
  const { AGENT_MODEL, getAnthropic } = await import("../../src/lib/llm/config");
  const [outDir, effort] = process.argv.slice(2);
  if (!outDir) throw new Error("Usage: run.ts <out-dir> [effort]");
  const client = getAnthropic();
  if (!client) throw new Error("No ANTHROPIC_API_KEY configured");
  await mkdir(outDir, { recursive: true });
  console.log(`model ${AGENT_MODEL}, effort ${effort ?? "default"}`);
  await Promise.all(
    Object.entries(TEXTS as Record<string, string>).map(async ([id, text]) => {
      const sample = { id };
      const started = Date.now();
      let output = 0;
      const extraction = await extractReferences(client, text.replace(/\r\n/g, "\n").trim(), {
        effort: effort as Effort | undefined,
        onUsage: (_, u) => (output += u.output_tokens),
      });
      await writeFile(path.join(outDir, `${sample.id}.json`), JSON.stringify(extraction, null, 2));
      console.log(`${sample.id}: ${extraction.references.length} refs, ${output} output tokens, ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }),
  );
}

main();
