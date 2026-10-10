// Scores reference extractions of src/content/samples.ts against evals/extraction/gold.json.
// Usage: npx tsx evals/extraction/score.ts <run-dir>
// <run-dir> holds one <sample-id>.json per sample, each matching ExtractionSchema.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ExtractionSchema } from "../../src/lib/analysis/extract";
import { scoreExtraction, type GoldSample } from "./scoring";
import { sampleById } from "../../src/content/samples";

async function scoreSample(id: string, gold: GoldSample, runDir: string) {
  const text = sampleById(id)?.text;
  if (!text) return { id, error: "no sample script with this id" };
  const raw = JSON.parse(await readFile(path.join(runDir, `${id}.json`), "utf8"));
  const parsed = ExtractionSchema.safeParse(raw);
  if (!parsed.success) return { id, error: parsed.error.message };
  return { id, ...scoreExtraction(text, parsed.data.references, gold) };
}

async function main() {
  const runDir = path.resolve(process.argv[2] ?? "");
  const gold: Record<string, GoldSample> = JSON.parse(await readFile(path.join(import.meta.dirname, "gold.json"), "utf8"));
  const available = new Set((await readdir(runDir)).map((f) => f.replace(/\.json$/, "")));
  const results = [];
  for (const id of Object.keys(gold).filter((k) => available.has(k))) results.push(await scoreSample(id, gold[id], runDir));

  for (const r of results) {
    if ("error" in r) {
      console.log(`\n## ${r.id}: SCHEMA ERROR\n${r.error}`);
      continue;
    }
    console.log(`\n## ${r.id}  refs=${r.refs}  recall=${(r.recall * 100).toFixed(0)}%  precision=${(r.precision * 100).toFixed(0)}%`);
    for (const key of ["misses", "unexpected", "forbidden", "kindErrors", "checkableErrors", "missingQuotes", "duplicates"] as const) {
      if (r[key].length) console.log(`  ${key}: ${r[key].join("; ")}`);
    }
  }
  const ok = results.filter((r): r is Exclude<typeof r, { error: string }> => !("error" in r));
  if (ok.length) {
    const avg = (k: "recall" | "precision") => ok.reduce((s, r) => s + r[k], 0) / ok.length;
    console.log(`\nMEAN recall=${(avg("recall") * 100).toFixed(1)}%  precision=${(avg("precision") * 100).toFixed(1)}%  over ${ok.length} samples`);
  }
}

main();
