// How often the model's blind gut call matches what Qloo measures, over the
// example scripts in their default rooms. Prints a summary; Qloo numbers are
// not written anywhere.
// Usage: npx tsx --env-file=.env.local evals/gut/compare.ts
import { SAMPLES } from "../../src/content/samples";
import { runAnalysis } from "../../src/lib/analysis/run";
import type { Analysis } from "../../src/lib/analysis/types";
import { gutRows } from "../../src/lib/ui/gut";

async function main() {
  let same = 0;
  let total = 0;
  let sameSign = 0;
  let signed = 0;
  let fans = 0;
  let gapSum = 0;
  for (const sample of SAMPLES) {
    let analysis: Analysis | undefined;
    await runAnalysis({ text: sample.text, presetId: sample.presetId, cities: [] }, (e) => {
      if (e.type === "done") analysis = e.analysis;
    });
    const rows = gutRows(analysis!.references);
    const agree = rows.filter((r) => r.same).length;
    same += agree;
    total += rows.length;
    for (const r of rows) {
      if (r.roomIndex !== undefined) {
        signed++;
        if (Math.sign(r.gut.roomIndex) === Math.sign(r.roomIndex)) sameSign++;
        gapSum += r.gap!;
      }
      if (r.fans && r.fans === r.gut.fans) fans++;
    }
    console.log(`${sample.id.padEnd(24)} same call ${agree}/${rows.length}`);
    for (const r of rows.filter((x) => !x.same)) {
      const room = r.roomIndex === undefined ? "  –  " : `${Math.round(r.roomIndex * 100)}%`.padStart(5);
      console.log(`   ${r.name.padEnd(24)} gut ${r.gut.verdict.padEnd(6)} ${`${Math.round(r.gut.roomIndex * 100)}%`.padStart(5)} | qloo ${r.verdict.padEnd(6)} ${room}`);
    }
}
console.log(`\nSame verdict: ${same}/${total} (${Math.round((100 * same) / total)}%)`);
console.log(`Same direction vs. average adult: ${sameSign}/${signed}; mean gap ${Math.round((100 * gapSum) / signed)} points`);
console.log(`Same biggest-fan age group: ${fans}/${total}`);
}

main();
