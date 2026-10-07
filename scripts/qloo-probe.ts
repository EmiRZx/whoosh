// Runs a fixed battery of Qloo requests and saves the raw responses to
// .cache/probe/ (git-ignored) so response shapes and value ranges can be
// checked before the scoring code depends on them.
// Usage: QLOO_API_KEY=... npx tsx scripts/qloo-probe.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileCache, MemoryCache, TieredCache } from "../src/lib/qloo/cache";
import { QlooClient, type QueryParams } from "../src/lib/qloo/client";

const OUT = path.resolve(".cache/probe");
const client = new QlooClient({
  apiKey: process.env.QLOO_API_KEY ?? "",
  baseUrl: process.env.QLOO_BASE_URL,
  cache: new TieredCache([new MemoryCache(), new FileCache(path.resolve(".cache/qloo"))]),
});

type Obj = Record<string, unknown>;
const results = (body: unknown) => (body as Obj | undefined)?.results;

function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length ? [`${value.length} items`, shape(value[0], depth + 1)] : [];
  if (value && typeof value === "object" && depth < 4) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, depth + 1)]));
  }
  return typeof value;
}

async function probe(name: string, pathName: string, params: QueryParams) {
  try {
    const body = await client.get(pathName, params);
    await writeFile(path.join(OUT, `${name}.json`), JSON.stringify(body, null, 2));
    console.log(`ok   ${name}  ${JSON.stringify(shape(results(body))).slice(0, 220)}`);
    return body;
  } catch (err) {
    console.log(`FAIL ${name}  ${(err as Error).message.slice(0, 200)}`);
    return undefined;
  }
}

async function firstId(name: string, query: string, types: string) {
  const body = await probe(name, "/search", { query, types, take: 5 });
  const list = results(body);
  const first = Array.isArray(list) ? (list[0] as Obj | undefined) : undefined;
  return (first?.entity_id ?? first?.id) as string | undefined;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // Resolution, including names that are ambiguous on purpose.
  const friends = await firstId("search-friends", "Friends", "urn:entity:tv_show");
  const sopranos = await firstId("search-sopranos", "The Sopranos", "urn:entity:tv_show");
  const breakingBad = await firstId("search-breaking-bad", "Breaking Bad", "urn:entity:tv_show");
  const loveIsland = await firstId("search-love-island", "Love Island", "urn:entity:tv_show");
  const swift = await firstId("search-taylor-swift", "Taylor Swift", "urn:entity:artist");
  await firstId("search-olive-garden", "Olive Garden", "urn:entity:brand");
  await firstId("search-canvas", "Canvas", "urn:entity:brand");
  await firstId("search-lebron", "LeBron James", "urn:entity:person");
  await probe("search-untyped-blockbuster", "/search", { query: "Blockbuster", take: 5 });
  await probe("search-locality-austin", "/search", { query: "Austin, Texas", types: "urn:entity:locality", take: 3 });
  if (!friends || !sopranos || !breakingBad) return console.log("Stopping: core searches failed.");

  await probe("entities-friends", "/entities", { entity_ids: friends });

  // Demographics: per-bucket index for one entity.
  await probe("demographics-friends", "/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": friends });
  if (swift) await probe("demographics-swift", "/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": swift });

  // Joint scoring of a shortlist under one audience signal (comparable within a response).
  const shortlist = [friends, sopranos, breakingBad, loveIsland].filter(Boolean).join(",");
  for (const age of ["24_and_younger", "55_and_older"]) {
    await probe(`joint-tv-${age}`, "/v2/insights", {
      "filter.type": "urn:entity:tv_show",
      "filter.results.entities": shortlist,
      "signal.demographics.age": age,
    });
  }
  await probe("joint-tv-location-austin", "/v2/insights", {
    "filter.type": "urn:entity:tv_show",
    "filter.results.entities": shortlist,
    "signal.location.query": "Austin, Texas",
  });

  // Geography: city-level heatmap around one city, and a wide one.
  await probe("heatmap-friends-austin-locality", "/v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": friends,
    "filter.location.query": "Austin, Texas",
    "output.heatmap.boundary": "urn:entity:locality",
  });
  await probe("heatmap-friends-point", "/v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": friends,
    "filter.location": "POINT(-97.7431 30.2672)",
    "filter.location.radius": 20000,
  });

  // Momentum.
  await probe("trending-friends", "/v2/trending", {
    "filter.type": "urn:entity:tv_show",
    "signal.interests.entities": friends,
    "filter.start_date": "2025-10-01",
    "filter.end_date": "2026-10-01",
  });
  await probe("insights-tv-trending-bias", "/v2/insights", { "filter.type": "urn:entity:tv_show", "bias.trends": "high", take: 10 });

  // Swap candidates: similar to the original, liked by a young room, well known.
  await probe("swap-candidates-friends-young", "/v2/insights", {
    "filter.type": "urn:entity:tv_show",
    "signal.interests.entities": friends,
    "signal.demographics.age": "24_and_younger",
    "filter.popularity.min": 0.8,
    "filter.exclude.entities": friends,
    take: 10,
  });

  // Tags and audiences.
  await probe("tags-sitcom", "/v2/tags", { "filter.query": "sitcom", take: 10 });
  await probe("tag-insights-friends", "/v2/insights", { "filter.type": "urn:tag", "signal.interests.entities": friends, take: 15 });
  await probe("audience-types", "/v2/audience-types", {});
  await probe("audiences", "/v2/audiences", { take: 20 });

  console.log(`\nRaw responses saved to ${OUT}`);
}

main();
