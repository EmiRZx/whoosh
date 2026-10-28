// MCP endpoint (Streamable HTTP): an agent can test a script on its crowd before it
// writes or delivers it. The tools run the same pipeline as the web app.
import { AsyncLocalStorage } from "node:async_hooks";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { REFERENCE_KINDS, extractReferences } from "@/lib/analysis/extract";
import { buildAudience, isExample, measureReference, runAnalysis, runSwapSearch, UserFacingError } from "@/lib/analysis/run";
import type { Analysis, AnalysisEvent, AnalyzedReference } from "@/lib/analysis/types";
import { localHooks } from "@/lib/analysis/hooks";
import { weakest } from "@/lib/analysis/verdict";
import { AUDIENCE_PRESETS } from "@/lib/audience/audience";
import { performerRoom, searchPerformers } from "@/lib/audience/performer";
import { getAnthropic } from "@/lib/llm/config";
import { clientIp, takeLiveSlot, takeLookupSlot } from "@/lib/limits";
import { AGE_BUCKETS } from "@/lib/qloo/api";
import { getQlooClient } from "@/lib/qloo/server";
import { cityScores } from "@/lib/ui/cities";
import { roomScore } from "@/lib/ui/score";

export const maxDuration = 300;

const ROOM_IDS = AUDIENCE_PRESETS.map((p) => p.id) as [string, ...string[]];

// The caller's address, for the same limits as the web app.
const caller = new AsyncLocalStorage<string>();

const Room = {
  room: z.enum(ROOM_IDS).default("general").describe("Who is in the room; see list_rooms"),
  performer: z
    .string()
    .max(80)
    .optional()
    .describe('A performer, show or podcast whose fans are the audience, e.g. "Cedric the Entertainer". Overrides room.'),
  cities: z.array(z.string().max(80)).max(6).optional().describe('Where it will be said, e.g. "Austin, TX". Each city gets its own verdicts.'),
};

class ToolError extends Error {}
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });
const ok = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const pct = (x: number | undefined) => (x === undefined ? undefined : Math.round(x * 100));

async function run<T>(work: () => Promise<T>) {
  try {
    return ok(await work());
  } catch (err) {
    if (err instanceof ToolError || err instanceof UserFacingError) return fail(err.message);
    console.error("mcp tool failed", err);
    return fail("That didn't work. Please try again.");
  }
}

async function performerId(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const qloo = getQlooClient();
  for (const hit of qloo ? await searchPerformers(qloo, name, 3).catch(() => []) : []) {
    if (await performerRoom(qloo!, hit.id).catch(() => null)) return hit.id;
  }
  throw new ToolError(`Qloo has no audience data for "${name}".`);
}

async function liveSlot(text?: string) {
  if (text && isExample(text)) return;
  if (!process.env.ANTHROPIC_API_KEY) return;
  const slot = await takeLiveSlot(`mcp:${caller.getStore() ?? "unknown"}`);
  if (!slot.ok) throw new ToolError(slot.message);
}

async function lookupSlot() {
  if (!(await takeLookupSlot(`mcp:${caller.getStore() ?? "unknown"}`))) throw new ToolError("Too many lookups. Try again in a bit.");
}

function describeReference(r: AnalyzedReference) {
  return {
    name: r.extracted.name,
    kind: r.extracted.kind,
    said_as: r.extracted.quotes,
    role: r.extracted.role || undefined,
    weight: r.extracted.weight,
    measured_as: r.resolution.entity?.name,
    verdict: r.verdict,
    by_city: Object.keys(r.cityVerdicts ?? {}).length > 1 ? r.cityVerdicts : undefined,
    room_vs_average_pct: pct(r.signals?.roomIndex),
    presence_pct: pct(r.signals?.recognition),
    city_ranks: r.signals?.cities?.map((c) => `${c.name}: #${c.rank} of ${c.of}`),
    reasons: r.reasons,
    swaps: r.swaps.length ? r.swaps.map((s) => ({ name: s.entity.name, verdict: s.verdict, rewrite: s.rewrite, why: s.why })) : undefined,
    swap_note: r.swapNote,
  };
}

function scores(analysis: Analysis) {
  const refs = analysis.references;
  const cities = analysis.audience.cities.map((c) => c.name);
  const byCity = cityScores(refs, cities);
  return {
    should_land_pct: pct(roomScore(refs.map((r) => ({ verdict: r.verdict, weight: r.extracted.weight })))),
    by_city: cities.length > 1 ? Object.fromEntries(cities.map((c, i) => [c, pct(byCity[i])])) : undefined,
  };
}

async function analyse(text: string, room: { room: string; performer?: string; cities?: string[] }, options: Parameters<typeof runAnalysis>[2]) {
  const events: AnalysisEvent[] = [];
  await runAnalysis({ text, presetId: room.room, cities: room.cities ?? [], performerId: await performerId(room.performer) }, (e) => events.push(e), options);
  const done = events.find((e): e is Extract<AnalysisEvent, { type: "done" }> => e.type === "done");
  if (!done) throw new ToolError("The analysis did not complete.");
  return { analysis: done.analysis, log: events.flatMap((e) => (e.type === "status" ? [e.message] : [])) };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "check_script",
      {
        title: "Check a script",
        description:
          "Find the names a script leans on (shows, songs, brands, teams, famous people, places) in writing that will be said out loud (stand-up set, speech, toast, lecture, keynote, ad copy), and call each one against a specific audience, using Qloo's taste graph. Songs map to their artist, characters and catchphrases to their show. Returns each reference with the job it does in the line, its call (lands, risky, dead, unchecked) with the reasons, its call in each city, and a room score. Fast by default; set find_swaps to also hunt for stand-ins (slower, a minute or more), or call find_swaps for one name.",
        inputSchema: z.object({
          text: z.string().min(1).max(8000).describe("The script, exactly as it will be said"),
          ...Room,
          find_swaps: z.boolean().default(false).describe("Also hunt for stand-ins for the weak names"),
        }),
      },
      async ({ text, find_swaps, ...room }, extra) =>
        run(async () => {
          await liveSlot(text);
          // No blind gut calls here: they're for showing a person the gap, and they cost time.
          const { analysis, log } = await analyse(text, room, { signal: extra.mcpReq.signal, deferSwaps: !find_swaps, skipGut: true });
          const pending = (analysis.swapTargets ?? []).map((k) => analysis.references.find((r) => r.key === k)?.extracted.name);
          return {
            room: analysis.audience.label,
            cities: analysis.audience.cities.map((c) => c.name),
            score: scores(analysis),
            references: analysis.references.map(describeReference),
            weak_without_swaps: pending.length ? pending : undefined,
            next: pending.length ? "Call find_swaps with the text and one of weak_without_swaps to get substitutes for it." : undefined,
            log,
          };
        }),
    );

    server.registerTool(
      "compare_rooms",
      {
        title: "Compare rooms",
        description:
          "Read one script once and check it against up to four rooms at once (a college crowd, a performer's fans, a corporate offsite in another city). Returns each reference's verdict in every room and each room's score, and names the references the rooms disagree on most. Use it to see who a script is for.",
        inputSchema: z.object({
          text: z.string().min(1).max(8000).describe("The script"),
          rooms: z
            .array(z.object(Room))
            .min(2)
            .max(4)
            .describe("The rooms to compare; each a preset room or a performer's fans, optionally with cities"),
        }),
      },
      async ({ text, rooms }, extra) =>
        run(async () => {
          await liveSlot(text);
          const anthropic = getAnthropic();
          const extraction = isExample(text) || !anthropic ? undefined : await extractReferences(anthropic, text.replace(/\r\n/g, "\n").trim());
          const results: Analysis[] = [];
          for (const room of rooms) {
            const { analysis } = await analyse(text, room, { signal: extra.mcpReq.signal, deferSwaps: true, skipGut: true, extraction });
            results.push(analysis);
          }
          const labels = results.map((a) => `${a.audience.label}${a.audience.cities.length ? ` in ${a.audience.cities.map((c) => c.name).join(" / ")}` : ""}`);
          const names = results[0].references.map((r) => r.extracted.name);
          const verdicts = names.map((name) => results.map((a) => a.references.find((r) => r.extracted.name === name)?.verdict ?? "unchecked"));
          const spread = (vs: string[]) => new Set(vs.filter((v) => v !== "unchecked")).size;
          return {
            rooms: labels.map((label, i) => ({ room: label, ...scores(results[i]) })),
            references: names.map((name, i) => ({
              name,
              role: results[0].references[i].extracted.role,
              verdicts: Object.fromEntries(labels.map((l, j) => [l, verdicts[i][j]])),
            })),
            biggest_splits: names.filter((_, i) => spread(verdicts[i]) > 1),
          };
        }),
    );

    server.registerTool(
      "find_swaps",
      {
        title: "Find swaps",
        description:
          "For one reference in a script, run Whoosh's swap agent: it hunts through Qloo for stand-ins that play the same part in the line and that this room likes better, checks each one the same way the original was checked, and rewrites the line. Takes a minute or two.",
        inputSchema: z.object({
          text: z.string().min(1).max(8000).describe("The script the reference is in"),
          reference: z.string().min(1).max(120).describe('The reference as Qloo would know it, e.g. "Friends" for a line about Ross and Rachel'),
          kind: z.enum(REFERENCE_KINDS).describe("What kind of thing it is"),
          said_as: z.string().max(200).optional().describe("The words in the text that carry it, if they differ from the name (\"Ross\")"),
          job: z.string().max(300).optional().describe("The job it does in the line, e.g. \"a dated sitcom that dates the speaker\""),
          ...Room,
        }),
      },
      async ({ text, reference, kind, said_as, job, ...room }, extra) =>
        run(async () => {
          await liveSlot();
          const performer = await performerId(room.performer);
          const { reference: measured } = await measureReference({
            name: reference,
            kind,
            text,
            quote: said_as ?? reference,
            role: job,
            presetId: room.room,
            cities: room.cities ?? [],
            performerId: performer,
          });
          if (!measured.spans.length) throw new ToolError(`"${said_as ?? reference}" isn't in the text; pass the words that carry it as said_as.`);
          if (measured.resolution.status !== "resolved") throw new ToolError(measured.reasons.join(" ") || "Qloo can't measure this one.");
          const result = await runSwapSearch(
            { text, presetId: room.room, cities: room.cities ?? [], performerId: performer, reference: { ...measured, verdict: weakest(measured) }, others: [] },
            { signal: extra.mcpReq.signal },
          );
          return {
            original: describeReference(measured),
            swaps: result.swaps.map((s) => ({ name: s.entity.name, verdict: s.verdict, rewrite: s.rewrite, why: s.why })),
            note: result.swapNote,
          };
        }),
    );

    server.registerTool(
      "score_reference",
      {
        title: "Score one reference",
        description:
          "Measure one reference (a show, artist, public figure, brand, place, book, game or podcast) for a room without a script: how present it is in culture today, how much this room likes it compared with the average adult, where each city ranks it, and the verdict. Fast; no model involved.",
        inputSchema: z.object({
          name: z.string().min(1).max(120).describe("The name as Qloo would know it"),
          kind: z.enum(REFERENCE_KINDS).describe("What kind of thing it is"),
          ...Room,
        }),
      },
      async ({ name, kind, ...room }) =>
        run(async () => {
          await lookupSlot();
          const { reference, audience } = await measureReference({ name, kind, presetId: room.room, cities: room.cities ?? [], performerId: await performerId(room.performer) });
          return { room: audience.label, ...describeReference(reference) };
        }),
    );

    server.registerTool(
      "fans_of",
      {
        title: "Who a performer's fans are",
        description:
          "The audience of a performer, show or podcast as Qloo measures it: the age mix of their fans and the big US cities where they cluster. Use it to pick the room for check_script (pass the same name as performer).",
        inputSchema: z.object({ performer: z.string().min(1).max(80).describe('e.g. "Nate Bargatze"') }),
      },
      async ({ performer }) =>
        run(async () => {
          await lookupSlot();
          const qloo = getQlooClient();
          if (!qloo) throw new ToolError("Qloo isn't connected.");
          const room = await performerRoom(qloo, (await performerId(performer))!);
          if (!room) throw new ToolError(`Qloo has no audience data for "${performer}".`);
          const biggest = [...AGE_BUCKETS].sort((a, b) => room.ageMix[b] - room.ageMix[a])[0];
          return {
            performer: room.performer.name,
            age_mix_pct: Object.fromEntries(AGE_BUCKETS.map((b) => [b, pct(room.ageMix[b])])),
            biggest_age_group: biggest,
            fans_most_concentrated_in: room.cities,
          };
        }),
    );

    server.registerTool(
      "crowd_hooks",
      {
        title: "Local hooks",
        description:
          "What a room's crowd likes in one city, from Qloo: local places that crowd favors and artists who do better there than nationally. Good for an opener, crowd work, or a line that makes a touring set feel local.",
        inputSchema: z.object({ city: z.string().min(1).max(80).describe('e.g. "Atlanta, GA"'), room: Room.room, performer: Room.performer }),
      },
      async ({ city, ...room }) =>
        run(async () => {
          await lookupSlot();
          const qloo = getQlooClient();
          if (!qloo) throw new ToolError("Qloo isn't connected.");
          const { audience, unknown } = await buildAudience({ presetId: room.room, cities: [city], performerId: await performerId(room.performer) });
          if (unknown.length) throw new ToolError(`Couldn't place "${city}" on the map. Try "City, ST".`);
          const hooks = await localHooks(qloo, audience.cities[0], audience.ageMix, audience.fansOf);
          if (!hooks) throw new ToolError("Qloo had nothing local for this crowd there.");
          return {
            city: hooks.city,
            room: audience.label,
            places: hooks.places.map((p) => ({ name: p.name, about: p.description })),
            artists: hooks.artists.map((a) => a.name),
          };
        }),
    );

    server.registerTool(
      "list_rooms",
      {
        title: "List rooms",
        description: "List the preset rooms the other tools understand, with each one's age mix. A performer's fans can be the room too (see fans_of).",
        inputSchema: z.object({}),
      },
      async () =>
        ok(
          AUDIENCE_PRESETS.map((p) => ({
            id: p.id,
            label: p.label,
            description: p.description,
            age_mix_pct: Object.fromEntries(AGE_BUCKETS.map((b) => [b, pct(p.ageMix[b])])),
          })),
        ),
    );
  },
  { serverInfo: { name: "whoosh", version: "0.2.0" } },
);

const handle = (request: Request) => caller.run(clientIp(request), () => handler(request));

export { handle as GET, handle as POST };
