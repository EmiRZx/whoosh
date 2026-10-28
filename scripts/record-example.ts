// Records the model's part of an example script so the example replays
// without an LLM: the extraction (<id>.json), and in <id>.replay.json which
// Qloo entry each ambiguous reference means, the blind gut calls for the
// example's room, and the swap agent's picks and rewrites. Only names and
// model output are written; Qloo data is looked up live and stays in the cache.
//
// Usage, in two steps (the second reads the files the first wrote):
//   npx tsx scripts/record-example.ts <sample-id>          extraction, picks, gut calls
//   npx tsx scripts/record-example.ts <sample-id> --swaps  swaps, through the app's own pipeline
//   npx tsx scripts/record-example.ts <sample-id> --redo "Name, Name"  search again for these references
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

const DIR = path.resolve("src/content/extractions");
const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();

async function recordModel(id: string) {
  const { SAMPLES } = await import("../src/content/samples");
  const { extractReferences } = await import("../src/lib/analysis/extract");
  const { buildReferences } = await import("../src/lib/analysis/references");
  const { findCandidates, pickCandidate } = await import("../src/lib/analysis/resolve");
  const { chooseCandidates } = await import("../src/lib/analysis/choose");
  const { gutCalls } = await import("../src/lib/analysis/gut");
  const { buildAudience } = await import("../src/lib/analysis/run");
  const { getAnthropic } = await import("../src/lib/llm/config");
  const { getQlooClient } = await import("../src/lib/qloo/server");
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`Unknown sample ${id}`);
  const anthropic = getAnthropic();
  const qloo = getQlooClient();
  if (!anthropic || !qloo) throw new Error("Needs ANTHROPIC_API_KEY and QLOO_API_KEY");
  const text = normalize(sample.text);

  const extraction = await extractReferences(anthropic, text, { effort: "high" });
  await writeFile(path.join(DIR, `${id}.json`), JSON.stringify(extraction, null, 2) + "\n");
  console.log(`${id}: ${extraction.references.length} references`);
  const references = buildReferences(text, extraction);
  const pending = references.filter((r) => r.resolution.status === "pending");
  const nameOf = (key: string) => references.find((r) => r.key === key)!.extracted.name;

  const searched = await Promise.all(
    pending.map(async (ref) => {
      const candidates = await findCandidates(qloo, ref.extracted).catch(() => []);
      return { ref, candidates, pick: pickCandidate(ref.extracted, candidates) };
    }),
  );
  const ambiguous = searched.filter((s) => s.pick.status === "ambiguous");
  const picks: Record<string, { name: string; type: string; year?: number; standIn?: string } | null> = {};
  if (ambiguous.length) {
    const { picks: chosen } = await chooseCandidates(
      anthropic,
      ambiguous.map(({ ref, pick }) => ({ id: ref.key, reference: ref.extracted, candidates: pick.status === "ambiguous" ? pick.candidates : [] })),
    );
    for (const p of chosen) {
      const entry = ambiguous.find((a) => a.ref.key === p.id);
      if (!entry || entry.pick.status !== "ambiguous") continue;
      const entity = p.choice === null ? undefined : entry.pick.candidates[p.choice];
      const twins = entity ? entry.pick.candidates.filter((c) => c.name === entity.name).length : 0;
      picks[entry.ref.extracted.name] = entity
        ? {
            name: entity.name,
            type: entity.types[0],
            ...(twins > 1 && entity.releaseYear ? { year: entity.releaseYear } : {}),
            ...(p.stand_in ? { standIn: p.note } : {}),
          }
        : null;
    }
  }
  console.log(`picks: ${JSON.stringify(picks)}`);

  const { audience } = await buildAudience({ presetId: sample.presetId, cities: sample.cities, performerId: sample.performer?.id });
  const { calls } = await gutCalls(
    anthropic,
    text,
    audience,
    audience.description,
    pending.map((r) => ({ id: r.key, reference: r.extracted })),
  );
  const gut = {
    [audience.presetId]: Object.fromEntries(
      calls.map(({ id: key, ...call }) => [nameOf(key), call]),
    ),
  };
  console.log(`gut calls for ${audience.presetId}: ${calls.length}`);
  // No swaps key yet: without one, the next step runs the live swap agent.
  await writeFile(path.join(DIR, `${id}.replay.json`), JSON.stringify({ picks, gut }, null, 2) + "\n");
}

async function recordSwaps(id: string) {
  // Swap agents get the time they need here; there is no host limit.
  process.env.ANALYSIS_BUDGET_MS ??= "1800000";
  const { SAMPLES } = await import("../src/content/samples");
  const { runAnalysis } = await import("../src/lib/analysis/run");
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`Unknown sample ${id}`);
  const file = path.join(DIR, `${id}.replay.json`);
  const replay = JSON.parse(await readFile(file, "utf8"));
  if (replay.swaps) throw new Error(`${id} already has recorded swaps; delete the swaps key to record them again`);

  let analysis: import("../src/lib/analysis/types").Analysis | undefined;
  await runAnalysis({ text: sample.text, presetId: sample.presetId, cities: sample.cities, performerId: sample.performer?.id }, (e) => {
    if (e.type === "status") console.log(`  ${e.message}`);
    if (e.type === "done") analysis = e.analysis;
  });
  if (!analysis) throw new Error("The analysis did not finish");
  const swaps: Record<string, { swaps: unknown[]; note: string }> = {};
  for (const r of analysis.references) {
    if (!r.swaps.length && !r.swapNote) continue;
    swaps[r.extracted.name] = {
      swaps: r.swaps.map((s) => ({
        name: s.entity.name,
        type: s.entity.type,
        ...(s.entity.releaseYear ? { year: s.entity.releaseYear } : {}),
        rewrite: s.rewrite,
        why: s.why,
      })),
      note: r.swapNote ?? "",
    };
    console.log(`${r.extracted.name} (${r.verdict}): ${r.swaps.map((s) => s.entity.name).join(", ") || "none"} | ${r.swapNote ?? ""}`);
  }
  await writeFile(file, JSON.stringify({ ...replay, swaps }, null, 2) + "\n");
}

// Runs the swap agent again for the named references and keeps the rest.
async function redoSwaps(id: string, names: string[]) {
  process.env.ANALYSIS_BUDGET_MS ??= "1800000";
  const { SAMPLES } = await import("../src/content/samples");
  const { runAnalysis, runSwapSearch } = await import("../src/lib/analysis/run");
  const { weakest } = await import("../src/lib/analysis/verdict");
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`Unknown sample ${id}`);
  const file = path.join(DIR, `${id}.replay.json`);
  const replay = JSON.parse(await readFile(file, "utf8"));
  const input = { text: sample.text, presetId: sample.presetId, cities: sample.cities, performerId: sample.performer?.id };
  let analysis: import("../src/lib/analysis/types").Analysis | undefined;
  await runAnalysis(input, (e) => {
    if (e.type === "done") analysis = e.analysis;
  });
  if (!analysis) throw new Error("The analysis did not finish");
  const refs = analysis.references;
  await Promise.all(
    names.map(async (name) => {
      const ref = refs.find((r) => r.extracted.name === name);
      if (!ref?.resolution.entity) return console.log(`${name}: not a measured reference`);
      const result = await runSwapSearch({
        ...input,
        reference: { ...ref, swaps: [], verdict: weakest(ref) },
        others: refs.filter((r) => r !== ref).map((r) => r.extracted.name),
      });
      replay.swaps = replay.swaps ?? {};
      replay.swaps[name] = {
        swaps: result.swaps.map((s) => ({ name: s.entity.name, type: s.entity.type, rewrite: s.rewrite, why: s.why })),
        note: result.swapNote ?? "",
      };
      console.log(`${name}: ${result.swaps.map((s) => `${s.entity.name} | ${s.rewrite}`).join(" || ") || "none"} | ${result.swapNote ?? ""}`);
    }),
  );
  await writeFile(file, JSON.stringify(replay, null, 2) + "\n");
}

async function main() {
  loadEnvConfig(process.cwd());
  const [id, flag] = process.argv.slice(2);
  if (!id) throw new Error("Usage: record-example.ts <sample-id> [--swaps]");
  if (flag === "--swaps") await recordSwaps(id);
  else if (flag === "--redo") await redoSwaps(id, (process.argv[4] ?? "").split(",").map((n) => n.trim()).filter(Boolean));
  else await recordModel(id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
