// Scores the extractions in live runs on real-world scripts against blind
// gold annotations of the same scripts.
// Usage: npx tsx evals/wild/score.ts <runs-dir> <gold.json>
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Analysis } from "../../src/lib/analysis/types";
import { scoreExtraction, type GoldSample } from "../extraction/scoring";

async function main() {
  const [dir, goldPath] = process.argv.slice(2);
  const gold: Record<string, GoldSample> = JSON.parse(await readFile(goldPath, "utf8"));
  const rows: (ReturnType<typeof scoreExtraction> & { id: string })[] = [];
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json"))) {
    const run: { case: { id: string; text: string }; analysis?: Analysis } = JSON.parse(await readFile(path.join(dir, f), "utf8"));
    const g = gold[run.case.id];
    if (!g || !run.analysis) continue;
    const r = scoreExtraction(run.case.text, run.analysis.references.map((x) => x.extracted), g);
    rows.push({ id: run.case.id, ...r });
    console.log(`\n## ${run.case.id}  refs=${r.refs}  recall=${(r.recall * 100).toFixed(0)}%  precision=${(r.precision * 100).toFixed(0)}%`);
    for (const key of ["misses", "unexpected", "forbidden", "kindErrors", "checkableErrors", "missingQuotes", "duplicates"] as const) {
      if (r[key].length) console.log(`  ${key}: ${r[key].join("; ")}`);
    }
  }
  const avg = (k: "recall" | "precision") => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  if (rows.length) console.log(`\nMEAN recall=${(avg("recall") * 100).toFixed(1)}%  precision=${(avg("precision") * 100).toFixed(1)}%  over ${rows.length} scripts`);
}

main();
