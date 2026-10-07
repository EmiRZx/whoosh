// Scores reference extractions against evals/extraction/gold.json.
// Usage: npx tsx evals/extraction/score.ts <run-dir>
// <run-dir> holds one <sample-id>.json per sample, each matching ExtractionSchema.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ExtractionSchema, locateQuotes, type ExtractedReference } from "../../src/lib/analysis/extract";

interface GoldItem {
  name: string;
  aliases?: string[];
  kinds: string[];
}
interface GoldSample {
  required: GoldItem[];
  optional: GoldItem[];
  forbidden: string[];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const names = (g: GoldItem) => [g.name, ...(g.aliases ?? [])].map(norm);

function matches(ref: ExtractedReference, g: GoldItem) {
  const n = norm(ref.name);
  return names(g).includes(n) || ref.quotes.some((q) => names(g).includes(norm(q)));
}

async function scoreSample(id: string, gold: GoldSample, runDir: string) {
  const text = await readFile(path.join(import.meta.dirname, "samples", `${id}.txt`), "utf8");
  const raw = JSON.parse(await readFile(path.join(runDir, `${id}.json`), "utf8"));
  const parsed = ExtractionSchema.safeParse(raw);
  if (!parsed.success) return { id, error: parsed.error.message };
  const refs = parsed.data.references;

  const matchedRequired = new Set<number>();
  const report = { misses: [] as string[], unexpected: [] as string[], forbidden: [] as string[], kindErrors: [] as string[], checkableErrors: [] as string[], missingQuotes: [] as string[], duplicates: [] as string[] };
  let optionalHits = 0;

  for (const ref of refs) {
    const r = gold.required.findIndex((g, i) => !matchedRequired.has(i) && matches(ref, g));
    const already = gold.required.findIndex((g, i) => matchedRequired.has(i) && matches(ref, g));
    const o = gold.optional.find((g) => matches(ref, g));
    const label = `${ref.name} [${ref.kind}]`;

    if (r >= 0) {
      matchedRequired.add(r);
      if (!gold.required[r].kinds.includes(ref.kind)) report.kindErrors.push(`${label}, expected ${gold.required[r].kinds.join("|")}`);
    } else if (o) {
      optionalHits++;
    } else if (already >= 0) {
      report.duplicates.push(label);
    } else if (gold.forbidden.some((f) => norm(f) === norm(ref.name) || ref.quotes.some((q) => norm(q) === norm(f)))) {
      report.forbidden.push(label);
    } else {
      report.unexpected.push(label);
    }

    if ((ref.kind === "other") === ref.checkable) report.checkableErrors.push(`${label} checkable=${ref.checkable}`);
    const { missing } = locateQuotes(text, ref.quotes);
    report.missingQuotes.push(...missing.map((q) => `${ref.name}: "${q}"`));
  }
  gold.required.forEach((g, i) => !matchedRequired.has(i) && report.misses.push(g.name));

  const precisionDenominator = refs.length - report.duplicates.length;
  return {
    id,
    refs: refs.length,
    recall: matchedRequired.size / gold.required.length,
    precision: precisionDenominator ? (matchedRequired.size + optionalHits) / precisionDenominator : 1,
    ...report,
  };
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
