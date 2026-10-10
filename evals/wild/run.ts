// Runs live analyses on real-world scripts (kept outside the repo: they are
// third-party texts) and saves each result with its timing and token use.
// A case is a JSON file with text, preset, cities and optionally a performer
// whose fans are the room.
// Usage: npx tsx evals/wild/run.ts <cases-dir> <out-dir> [concurrency] [id-filter]
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

interface Case {
  id: string;
  title: string;
  format: string;
  preset: string;
  cities: string[];
  performer?: string;
  text: string;
  laughs?: number[];
}

async function main() {
  loadEnvConfig(process.cwd());
  const { runAnalysis } = await import("../../src/lib/analysis/run");
  const { UsageMeter } = await import("../../src/lib/llm/config");
  const { performerRoom, searchPerformers } = await import("../../src/lib/audience/performer");
  const { getQlooClient } = await import("../../src/lib/qloo/server");
  const [casesDir, outDir, concurrency = "2", filter = ""] = process.argv.slice(2);
  if (!casesDir || !outDir) throw new Error("Usage: run.ts <cases-dir> <out-dir> [concurrency] [id-filter]");
  await mkdir(outDir, { recursive: true });
  const done = new Set((await readdir(outDir)).map((f) => f.replace(/\.json$/, "")));
  const files = (await readdir(casesDir)).filter((f) => f.endsWith(".json") && f.includes(filter));
  const cases: Case[] = [];
  for (const f of files) {
    const c = JSON.parse(await readFile(path.join(casesDir, f), "utf8"));
    if (c.text && c.id && !done.has(c.id)) cases.push(c);
  }
  console.log(`${cases.length} cases to run`);

  const qloo = getQlooClient();
  const runOne = async (c: Case) => {
    let performerId: string | undefined;
    if (c.performer && qloo) {
      for (const hit of await searchPerformers(qloo, c.performer, 3).catch(() => [])) {
        if (await performerRoom(qloo, hit.id).catch(() => null)) {
          performerId = hit.id;
          break;
        }
      }
    }
    const meter = new UsageMeter();
    const started = Date.now();
    let analysis: unknown;
    let error: string | undefined;
    const statuses: string[] = [];
    try {
      await runAnalysis({ text: c.text, presetId: c.preset, cities: c.cities ?? [], performerId }, (e) => {
        if (e.type === "done") analysis = e.analysis;
        if (e.type === "error") error = e.message;
        if (e.type === "status") statuses.push(e.message);
      }, { meter });
    } catch (err) {
      error = (err as Error).message;
    }
    const seconds = (Date.now() - started) / 1000;
    await writeFile(
      path.join(outDir, `${c.id}.json`),
      JSON.stringify({ case: c, performerId, seconds, usage: meter.summary(), statuses, error, analysis }, null, 1),
    );
    console.log(`${c.id}: ${error ? `ERROR ${error}` : "ok"} in ${seconds.toFixed(0)}s`);
  };

  const queue = [...cases];
  await Promise.all(
    Array.from({ length: Number(concurrency) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) await runOne(c);
    }),
  );
}

main();
