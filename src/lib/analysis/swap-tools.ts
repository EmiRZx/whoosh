// The swap agent's tools, shared by the Claude tool loop (swap-agent.ts) and
// the CLI used to exercise them (scripts/swap-tools.ts). Results are compact
// on purpose: the model needs names, a few facts and Qloo's verdict, not raw
// payloads.
import { z } from "zod";
import type { AgeMix } from "../audience/audience";
import { AGE_BUCKETS, findTags, getEntities, insightEntities, search, type EntityType, type QlooEntity } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import { measure } from "./measure";
import { isPolitical } from "./politics";
import type { City, Verdict } from "./types";
import { AGE_LABEL, judge } from "./verdict";

export interface SwapContext {
  original: {
    id: string;
    // The name the writer used, and the Qloo entity it was measured as.
    name: string;
    entity_name: string;
    stand_in?: string;
    type: string;
    kind: string;
    role: string;
    weight: "punchline" | "setup" | "color";
    quotes: string[];
    // What the agent rewrites, and the paragraph around it for context.
    line: string;
    context?: string;
    verdict: Verdict;
    reasons: string[];
    room_index?: number;
    presence?: number;
  };
  // A performer's crowd also steers candidate search by the fans' taste.
  audience: { label: string; ageMix: AgeMix; cities: City[]; performer?: { id: string; name: string } };
  // Other references in the script, so a swap doesn't repeat one.
  others: string[];
  // Everything check() has measured in this session, by entity id.
  checked: Record<string, Checked>;
}

export interface Checked {
  id: string;
  name: string;
  type: string;
  verdict: Verdict;
  presence?: number;
  room_index?: number;
  biggest_fans?: string;
  cities?: string[];
  // Whether it's clearly a better fit for this room than the original.
  beats_original?: boolean;
}

// A swap has to land and also be clearly better for this room: warmer than
// the original by a margin, or, when the original has no age data, not
// noticeably cold. "Lands" alone lets through household names the room is
// lukewarm on (a host whose fans are mostly over 55, for a college crowd).
export const SWAP_RULES = {
  margin: 0.05, // warmer than the original by at least this much
  coldest: -0.25, // and never colder than this, however cold the original was
  floorWithoutData: -0.1, // when the original has no age data
  householdName: 0.95, // presence that stands in for missing age data...
  faded: 0.5, // ...when it replaces a reference below this presence
};

export function beatsOriginal(
  candidate: { verdict: Verdict; room_index?: number; presence?: number },
  original: { room_index?: number; presence?: number },
): boolean {
  if (candidate.verdict !== "lands") return false;
  // Some household names have no age breakdown in Qloo (Steve Harvey). Trading
  // a faded reference for one of them is still a clear improvement.
  if (candidate.room_index === undefined) {
    const fadedOriginal = original.presence === undefined || original.presence < SWAP_RULES.faded;
    return fadedOriginal && (candidate.presence ?? 0) >= SWAP_RULES.householdName;
  }
  if (original.room_index === undefined) return candidate.room_index >= SWAP_RULES.floorWithoutData;
  return candidate.room_index >= Math.max(original.room_index + SWAP_RULES.margin, SWAP_RULES.coldest);
}

const compact = (e: QlooEntity) => ({
  id: e.id,
  name: e.name,
  type: e.types[0]?.replace("urn:entity:", ""),
  year: e.releaseYear,
  popularity: e.popularity === undefined ? undefined : Math.round(e.popularity * 100) / 100,
  room_affinity: e.affinity === undefined ? undefined : Math.round(e.affinity * 100) / 100,
  tags: e.tags.slice(0, 5).map((t) => t.name),
  about: e.description?.slice(0, 140),
});

// Insights types differ from search types: authors, actors and directors are
// people, and neighborhoods aren't recommendable.
const INSIGHT_TYPE: Record<string, string> = {
  "urn:entity:author": "urn:entity:person",
  "urn:entity:actor": "urn:entity:person",
  "urn:entity:director": "urn:entity:person",
  "urn:entity:locality": "urn:entity:destination",
};

export const SWAP_TYPES = ["movie", "tv_show", "artist", "person", "brand", "book", "videogame", "podcast", "place", "destination"] as const;

const dominantAge = (mix: AgeMix) => [...AGE_BUCKETS].sort((a, b) => mix[b] - mix[a])[0];

export const FindCandidatesInput = z.object({
  type: z.enum(SWAP_TYPES).optional().describe("Kind of substitute to look for; defaults to the original's"),
  similar_to: z.string().optional().describe("Entity id to find things similar to; defaults to the original reference"),
  tag_ids: z.array(z.string()).max(5).optional().describe("Qloo tag ids (from find_tags) the substitute must have at least one of"),
  min_popularity: z.number().min(0).max(1).optional().describe("Minimum popularity percentile, default 0.85 so the room is likely to know it"),
  released_after: z.number().int().optional().describe("Only movies or TV shows released in or after this year"),
});

export async function findCandidates(client: QlooClient, ctx: SwapContext, input: z.infer<typeof FindCandidatesInput>) {
  const original = ctx.original;
  const type = input.type ? `urn:entity:${input.type}` : (INSIGHT_TYPE[original.type] ?? original.type);
  const results = await insightEntities(client, {
    "filter.type": type,
    "signal.interests.entities": [input.similar_to ?? original.id, ctx.audience.performer?.id].filter(Boolean).join(","),
    "signal.demographics.age": dominantAge(ctx.audience.ageMix),
    "filter.popularity.min": input.min_popularity ?? 0.85,
    "filter.exclude.entities": original.id,
    "filter.tags": input.tag_ids?.join(","),
    "operator.filter.tags": input.tag_ids?.length ? "union" : undefined,
    "filter.release_year.min": input.released_after && /movie|tv_show/.test(type) ? input.released_after : undefined,
    take: 10,
  });
  return results.filter((e) => !isPolitical(e)).map(compact);
}

export const LookupInput = z.object({
  name: z.string().describe("Name of a specific substitute you have in mind"),
  type: z.enum(SWAP_TYPES).describe("What kind of thing it is"),
});

export async function lookup(client: QlooClient, input: z.infer<typeof LookupInput>) {
  const type = (input.type === "videogame" ? "urn:entity:videogame" : `urn:entity:${input.type}`) as EntityType;
  return (await search(client, input.name, { types: [type], take: 5 })).filter((e) => !isPolitical(e)).map(compact);
}

export const FindTagsInput = z.object({ query: z.string().describe('A genre or descriptor, e.g. "sitcom", "fast food", "boy band"') });

export async function findTagIds(client: QlooClient, input: z.infer<typeof FindTagsInput>) {
  return (await findTags(client, input.query, 10)).map((t) => ({ id: t.id, name: t.name }));
}

export const CheckInput = z.object({
  ids: z.array(z.string()).min(1).max(5).describe("Entity ids to check against this room"),
});

// Measures substitutes exactly the way the original was measured.
export async function check(client: QlooClient, ctx: SwapContext, input: z.infer<typeof CheckInput>): Promise<Checked[]> {
  const entities = await getEntities(client, input.ids);
  const measured = await measure(
    client,
    entities.map((e) => ({ key: e.id, entity: e })),
    { ageMix: ctx.audience.ageMix, cities: ctx.audience.cities },
  );
  return entities.map((e) => {
    const m = measured.get(e.id) ?? {};
    const { verdict } = judge(m, e.types[0] ?? "", ctx.original.weight);
    const fans = AGE_BUCKETS.filter((b) => m.profile?.age[b] !== undefined).sort((a, b) => m.profile!.age[b]! - m.profile!.age[a]!)[0];
    const result: Checked = {
      id: e.id,
      name: e.name,
      type: e.types[0] ?? "",
      verdict,
      presence: m.recognition === undefined ? undefined : Math.round(m.recognition * 100) / 100,
      room_index: m.roomIndex === undefined ? undefined : Math.round(m.roomIndex * 100) / 100,
      biggest_fans: fans ? `${AGE_LABEL[fans]} (${m.profile!.age[fans]! >= 0 ? "+" : ""}${Math.round(m.profile!.age[fans]! * 100)}%)` : undefined,
      cities: m.cities?.map((c) => `${c.name} #${c.rank} of ${c.of}`),
    };
    // Political figures are never offered as swaps.
    result.beats_original = !isPolitical(e) && beatsOriginal(result, ctx.original);
    ctx.checked[e.id] = result;
    return result;
  });
}

export const SubmitInput = z.object({
  swaps: z
    .array(
      z.object({
        id: z.string().describe("Entity id of a substitute whose check() result has beats_original: true"),
        rewrite: z.string().describe("The line rewritten with the substitute, changing as little as possible"),
        why: z.string().describe("One sentence on why it does the same job for this room"),
      }),
    )
    .max(3),
  note: z.string().describe("One sentence for the performer, e.g. why there are fewer than three swaps"),
});

const squash = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Loose on purpose: Qloo stores some names without spaces
// ("Moe'sSouthwestGrill") and writers shorten them ("Moe's"), so the rewrite
// only has to contain the name's first word.
export function mentions(rewrite: string, name: string): boolean {
  const base = name.split(/[:(]/)[0].trim();
  const words = base.split(/\s+/);
  let first = words[0];
  if (words.length === 1) first = first.split(/(?<=[a-z'])(?=[A-Z])/)[0];
  const key = squash(first).length >= 4 ? squash(first) : squash(base).slice(0, 5);
  return key.length > 0 && squash(rewrite).includes(key);
}

// Code, not the model, enforces that every swap was measured and lands.
export function validateSubmission(ctx: SwapContext, input: z.infer<typeof SubmitInput>): string[] {
  const problems: string[] = [];
  for (const swap of input.swaps) {
    const c = ctx.checked[swap.id];
    if (!c) problems.push(`${swap.id} was never checked; run check on it first.`);
    else if (c.verdict !== "lands") problems.push(`${c.name} checks as "${c.verdict}" for this room; only substitutes that land can be submitted.`);
    else if (!beatsOriginal(c, ctx.original)) {
      problems.push(`${c.name} lands but isn't clearly a better fit for this room than the original (room index ${c.room_index ?? "unknown"}); drop it.`);
    } else if (!mentions(swap.rewrite, c.name)) {
      problems.push(`The rewrite for ${c.name} doesn't seem to mention it.`);
    }
    if (swap.rewrite.trim() === ctx.original.line.trim()) problems.push(`The rewrite for ${swap.id} is identical to the original line.`);
  }
  if (new Set(input.swaps.map((s) => s.id)).size !== input.swaps.length) problems.push("Each substitute can appear once.");
  return problems;
}
