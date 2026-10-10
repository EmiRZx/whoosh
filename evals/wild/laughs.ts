// Do references we call "lands" sit in lines that got a laugh more often than
// the ones we call weak? Uses transcripts that mark audience laughter: each
// stretch of text up to a laugh (or a paragraph break) is one joke, and a
// reference counts as laughed-at when its joke ends in a laugh.
// Usage: npx tsx evals/wild/laughs.ts <runs-dir>
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Analysis, Verdict } from "../../src/lib/analysis/types";

interface Run {
  case: { id: string; text: string; laughs?: number[] };
  analysis?: Analysis;
}

// Joke boundaries: every laugh, and every paragraph break.
function jokes(text: string, laughs: number[]) {
  const cuts = new Set<number>([0, text.length, ...laughs]);
  for (let i = text.indexOf("\n\n"); i >= 0; i = text.indexOf("\n\n", i + 2)) cuts.add(i);
  const points = [...cuts].sort((a, b) => a - b);
  const laughed = new Set(laughs);
  return points.slice(1).map((end, i) => ({ start: points[i], end, laughed: laughed.has(end) }));
}

async function main() {
  const dir = process.argv[2];
  const tally: Record<string, { laughed: number; total: number }> = {};
  const add = (k: string, laughed: boolean) => {
    tally[k] ??= { laughed: 0, total: 0 };
    tally[k].total++;
    if (laughed) tally[k].laughed++;
  };
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json"))) {
    const run: Run = JSON.parse(await readFile(path.join(dir, f), "utf8"));
    if (!run.case.laughs?.length || !run.analysis) continue;
    const units = jokes(run.case.text, run.case.laughs);
    const withRef = new Set<number>();
    for (const ref of run.analysis.references) {
      const span = ref.spans[0];
      if (!span) continue;
      const u = units.findIndex((x) => x.start <= span.start && span.start < x.end);
      if (u < 0) continue;
      withRef.add(u);
      const v: Verdict = ref.verdict;
      add(`verdict: ${v}`, units[u].laughed);
      if (v !== "unchecked") add(v === "lands" ? "group: lands" : "group: risky or won't land", units[u].laughed);
      if (ref.gut && v !== "unchecked") add(`gut: ${ref.gut.verdict === "lands" ? "lands" : "risky or won't land"}`, units[u].laughed);
    }
    units.forEach((u, i) => add(withRef.has(i) ? "jokes with a reference" : "jokes without a reference", u.laughed));
  }
  for (const [k, t] of Object.entries(tally).sort()) {
    console.log(`${k.padEnd(32)} ${String(t.laughed).padStart(3)}/${String(t.total).padEnd(3)} laughed (${Math.round((100 * t.laughed) / t.total)}%)`);
  }
}

main();
