// Collects every swap from live runs into judging tasks: the original passage,
// the rewrite, the job the reference does, and who is in the room. A judge
// scores whether the rewrite still does the job; whether the room knows the
// substitute is Qloo's call, not the judge's.
// Usage: npx tsx evals/wild/swap-tasks.ts <runs-dir> <out.json>
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Analysis } from "../../src/lib/analysis/types";
import { passageAround, paragraphAround } from "../../src/lib/analysis/references";

async function main() {
  const [dir, out] = process.argv.slice(2);
  const tasks = [];
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json"))) {
    const run: { case: { id: string; text: string; format: string }; analysis?: Analysis } = JSON.parse(await readFile(path.join(dir, f), "utf8"));
    const a = run.analysis;
    if (!a) continue;
    for (const ref of a.references) {
      if (!ref.swaps.length || !ref.spans.length) continue;
      for (const swap of ref.swaps) {
        tasks.push({
          id: `${run.case.id}/${ref.key}/${swap.entity.name}`,
          format: run.case.format,
          room: `${a.audience.label}: ${a.audience.description}`,
          paragraph: paragraphAround(a.text, ref.spans[0].start),
          original_line: passageAround(a.text, ref.spans),
          reference: ref.extracted.name,
          job: ref.extracted.role,
          substitute: swap.entity.name,
          rewrite: swap.rewrite,
        });
      }
    }
  }
  await writeFile(out, JSON.stringify(tasks, null, 1));
  console.log(`${tasks.length} swaps to judge`);
}

main();
