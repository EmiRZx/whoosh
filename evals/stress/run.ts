// Runs the stress cases through the live pipeline and checks each one.
// Usage: npx tsx evals/stress/run.ts [id-filter]
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { runAnalysis } = await import("../../src/lib/analysis/run");
  const { STRESS_CASES } = await import("./cases");
  type Analysis = import("../../src/lib/analysis/types").Analysis;
  const filter = process.argv[2] ?? "";
  let failed = 0;
  for (const c of STRESS_CASES.filter((x) => x.id.includes(filter))) {
    let analysis: Analysis | undefined;
    let error: string | undefined;
    const started = Date.now();
    try {
      await runAnalysis({ text: c.text, presetId: c.presetId, cities: c.cities }, (e) => {
        if (e.type === "done") analysis = e.analysis;
        if (e.type === "error") error = e.message;
      });
    } catch (err) {
      error = (err as Error).message;
    }
    const problems: string[] = [];
    if (error || !analysis) problems.push(`no result: ${error}`);
    const refs = analysis?.references ?? [];
    const names = refs.map((r) => `${r.extracted.name} ${r.resolution.entity?.name ?? ""}`.toLowerCase());
    for (const e of c.expect ?? []) if (!names.some((n) => n.includes(e.toLowerCase()))) problems.push(`missing ${e}`);
    for (const f of c.forbid ?? []) if (refs.some((r) => r.extracted.name.toLowerCase() === f.toLowerCase())) problems.push(`extracted ${f}`);
    if (c.maxReferences !== undefined && refs.length > c.maxReferences) problems.push(`${refs.length} references (max ${c.maxReferences})`);
    const dump = JSON.stringify(analysis ?? {}).toLowerCase();
    for (const n of c.never ?? []) if (dump.includes(n.toLowerCase())) problems.push(`output contains "${n}"`);
    if (problems.length) failed++;
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`${problems.length ? "FAIL" : "PASS"} ${c.id} (${secs}s) refs: ${refs.map((r) => `${r.extracted.name}[${r.verdict}]`).join(", ") || "none"}`);
    for (const p of problems) console.log(`     - ${p}`);
  }
  console.log(failed ? `${failed} failing` : "all passing");
}

main();
