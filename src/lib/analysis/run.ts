import { RECORDED_EXTRACTIONS } from "@/content/extractions";
import { RECORDED_GUT } from "@/content/extractions/gut";
import { RECORDED_PICKS } from "@/content/extractions/picks";
import { SAMPLES } from "@/content/samples";
import { AUDIENCE_PRESETS, presetById } from "../audience/audience";
import { findCity } from "../geo/cities";
import { RECORDED_SWAPS, type RecordedSwap } from "@/content/extractions/swaps";
import { search, type EntityType, type QlooEntity } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import { getQlooClient } from "../qloo/server";
import { performerLabel, performerRoom } from "../audience/performer";
import { getAnthropic, UsageMeter, type LlmOptions } from "../llm/config";
import { chooseCandidates } from "./choose";
import { extractReferences, type Extraction } from "./extract";
import { gutCalls, toGutCall } from "./gut";
import { measure } from "./measure";
import { buildReferences, paragraphAround, passageAround } from "./references";
import { findCandidates, pickCandidate, toSummary, type Pick as CandidatePick } from "./resolve";
import { runSwapAgent, type SwapResult } from "./swap-agent";
import { check, type SwapContext } from "./swap-tools";
import { localHooks } from "./hooks";
import type { AnalysisEvent, AnalyzedReference, AudienceSpec, LocalHooks } from "./types";
import { isPolitical } from "./politics";
import { judge } from "./verdict";

export interface AnalysisInput {
  text: string;
  presetId: string;
  cities: string[];
  // A Qloo entity id: the room is this performer's fans instead of a preset.
  performerId?: string;
}

// Errors whose message is safe and useful to show the user as-is.
export class UserFacingError extends Error {}

const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();

type Resolution = { entity: QlooEntity; standIn?: string } | { candidates: QlooEntity[] } | null;

// True when the text is one of the built-in examples, which replay recorded
// model output and never call Claude.
export function isExample(text: string) {
  const t = normalize(text);
  return SAMPLES.some((s) => normalize(s.text) === t && !!RECORDED_EXTRACTIONS[s.id]);
}

// Hosts cap a request's duration (300 s on Vercel Hobby). Swap agents get
// whatever is left of this budget and are stopped when it runs out, so the
// analysis always finishes with what it has.
const BUDGET_MS = Number(process.env.ANALYSIS_BUDGET_MS) || 270_000;
// Below this, starting a swap agent isn't worth it.
const MIN_SWAP_MS = 25_000;

export async function runAnalysis(
  input: AnalysisInput,
  send: (event: AnalysisEvent) => void,
  // deferSwaps: leave the live swap search to separate requests (see
  // runSwapSearch), so it gets a host time limit of its own.
  options: { signal?: AbortSignal; meter?: UsageMeter; deferSwaps?: boolean } = {},
) {
  const meter = options.meter ?? new UsageMeter();
  const llm: LlmOptions = { signal: options.signal, onUsage: meter.record };
  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  // Status lines double as a timing log on the server.
  const timed = (event: AnalysisEvent) => {
    if (event.type === "status") console.info(`[analysis ${elapsed()}] ${event.message}`);
    send(event);
  };
  try {
    await analyze(input, timed, llm, started + BUDGET_MS, options.deferSwaps ?? false);
  } finally {
    console.info(`[analysis ${elapsed()}] finished`);
    if (!meter.empty) console.info("llm usage", JSON.stringify(meter.summary()));
  }
}

// The room an analysis is measured against: a preset or a performer's fans,
// plus the cities that could be placed on the map.
export async function buildAudience(input: { presetId: string; cities: string[]; performerId?: string }) {
  const preset = presetById(input.presetId) ?? AUDIENCE_PRESETS[0];
  const cities = input.cities.map((name) => ({ name, match: findCity(name) }));
  const unknown = cities.filter((c) => !c.match).map((c) => c.name);
  const located = cities.map(({ name, match }) => (match ? { name: match.label, lat: match.lat, lon: match.lon } : { name }));
  let audience: AudienceSpec = {
    presetId: preset.id,
    label: preset.label,
    description: preset.description,
    ageMix: preset.ageMix,
    cities: located,
  };
  if (input.performerId) {
    const qloo = getQlooClient();
    const room = qloo ? await performerRoom(qloo, input.performerId).catch(() => null) : null;
    if (!room) throw new UserFacingError("Qloo has no audience data for that performer. Pick another one, or one of the rooms.");
    audience = {
      presetId: "performer",
      label: performerLabel(room.performer.name),
      description: `people who are fans of ${room.performer.name}, with the age mix Qloo measures for that audience`,
      ageMix: room.ageMix,
      cities: located,
      performer: room.performer,
      fansOf: room.audienceId,
    };
  }
  return { audience, unknown };
}

async function analyze(input: AnalysisInput, send: (event: AnalysisEvent) => void, llm: LlmOptions, deadline: number, deferSwaps: boolean) {
  const text = normalize(input.text);
  const { audience, unknown } = await buildAudience(input);
  if (unknown.length) {
    send({ type: "status", message: `Couldn't place ${unknown.join(", ")} on the map; city checks will skip ${unknown.length > 1 ? "them" : "it"}` });
  }

  // 1. Find the references.
  const sample = SAMPLES.find((s) => normalize(s.text) === text);
  const anthropic = getAnthropic();
  let extraction: Extraction;
  let mode: "live" | "replay";
  if (sample && RECORDED_EXTRACTIONS[sample.id]) {
    send({ type: "status", message: "Reading the script (recorded example)" });
    extraction = RECORDED_EXTRACTIONS[sample.id];
    mode = "replay";
  } else if (anthropic) {
    send({ type: "status", message: "Reading the script" });
    extraction = await extractReferences(anthropic, text, llm);
    mode = "live";
  } else {
    throw new UserFacingError("Live analysis isn't switched on yet. Try one of the examples.");
  }

  let references = buildReferences(text, extraction);
  send({ type: "references", references });
  const update = (key: string, patch: Partial<AnalyzedReference>) => {
    references = references.map((r) => (r.key === key ? { ...r, ...patch } : r));
    send({ type: "update", key, patch });
  };
  let hooks: LocalHooks[] = [];

  // The model's gut call on each reference, made blind to Qloo, runs
  // alongside the measurement so the two can be compared.
  const gutDone = (async () => {
    const targets = references.filter((r) => r.resolution.status === "pending");
    if (!targets.length) return;
    try {
      // Examples never call the model: they show a recorded gut call when one
      // exists for this room, and none otherwise.
      if (mode === "replay") {
        const recorded = sample ? RECORDED_GUT[sample.id]?.[audience.presetId] : undefined;
        for (const ref of recorded ? targets : []) {
          const call = recorded![ref.extracted.name];
          if (call) update(ref.key, { gut: toGutCall({ id: ref.key, ...call }) });
        }
      } else if (anthropic) {
        send({ type: "status", message: "Asking the model for its gut call on each reference, before it sees any data" });
        const { calls } = await gutCalls(
          anthropic,
          text,
          audience,
          audience.description,
          targets.map((r) => ({ id: r.key, reference: r.extracted })),
          llm,
        );
        for (const call of calls) {
          if (targets.some((r) => r.key === call.id)) update(call.id, { gut: toGutCall(call) });
        }
      }
    } catch (err) {
      if (!llm.signal?.aborted) console.error("gut calls failed", err);
    }
  })();

  // Live swap searches left for the client to request one by one.
  let swapTargets: string[] | undefined;
  const finish = async () => {
    await gutDone;
    send({ type: "done", analysis: { text, audience, references, mode, hooks, swapTargets } });
  };

  const qloo = getQlooClient();
  const checkable = references.filter((r) => r.resolution.status === "pending");
  if (!qloo || !checkable.length) {
    send({ type: "status", message: qloo ? "Nothing here to check against Qloo" : "Qloo isn't connected, so references stay unchecked" });
    return finish();
  }

  // 2. Match each reference to a Qloo entity.
  send({ type: "status", message: `Looking up ${checkable.length} references in Qloo` });
  const searched = await Promise.all(
    checkable.map(async (ref) => {
      const candidates = await findCandidates(qloo, ref.extracted).catch(() => []);
      return { ref, candidates, pick: pickCandidate(ref.extracted, candidates) as CandidatePick };
    }),
  );

  const resolutions = new Map<string, Resolution>();
  for (const { ref, pick } of searched) {
    resolutions.set(ref.key, pick.status === "resolved" ? { entity: pick.entity } : pick.status === "ambiguous" ? { candidates: pick.candidates } : null);
  }

  const ambiguous = searched.filter((s) => s.pick.status === "ambiguous");
  if (ambiguous.length) {
    const recorded = mode === "replay" && sample ? RECORDED_PICKS[sample.id] : undefined;
    if (recorded) {
      for (const { ref, candidates } of ambiguous) {
        const pick = recorded[ref.extracted.name];
        if (pick === undefined) continue;
        const entity =
          pick &&
          candidates.find((c) => c.name === pick.name && c.types.includes(pick.type) && (pick.year === undefined || c.releaseYear === pick.year));
        resolutions.set(ref.key, entity ? { entity, standIn: pick.standIn } : null);
      }
    } else if (anthropic) {
      send({ type: "status", message: `Deciding which Qloo entry ${ambiguous.length > 1 ? `${ambiguous.length} references mean` : `"${ambiguous[0].ref.extracted.name}" means`}` });
      try {
        const { picks } = await chooseCandidates(
          anthropic,
          ambiguous.map(({ ref, candidates }) => ({ id: ref.key, reference: ref.extracted, candidates })),
          llm,
        );
        for (const p of picks) {
          const entry = ambiguous.find((a) => a.ref.key === p.id);
          if (!entry) continue;
          const entity = p.choice === null ? undefined : entry.candidates[p.choice];
          resolutions.set(p.id, entity ? { entity, standIn: p.stand_in ? p.note : undefined } : null);
        }
      } catch (err) {
        if (llm.signal?.aborted) throw err;
        console.error("candidate matching failed", err);
      }
    }
  }

  for (const ref of checkable) {
    const r = resolutions.get(ref.key);
    if (r && "entity" in r && isPolitical(r.entity)) {
      // Missed by the extractor; Qloo's tags say it's a political figure.
      resolutions.delete(ref.key);
      update(ref.key, {
        resolution: { status: "not_checkable", entity: toSummary(r.entity) },
        reasons: ["A political figure: Whoosh doesn't measure political taste, so this one is your call."],
      });
    } else if (r && "entity" in r) update(ref.key, { resolution: { status: "resolved", entity: toSummary(r.entity), standIn: r.standIn } });
    else if (r) update(ref.key, { resolution: { status: "ambiguous", candidates: r.candidates.map(toSummary) } });
    else update(ref.key, { resolution: { status: "not_found" }, reasons: ["Qloo doesn't have this one, so it's your call."] });
  }

  // 3. Ask Qloo how this room feels about each one, then call it.
  const items = checkable.flatMap((ref) => {
    const r = resolutions.get(ref.key);
    return r && "entity" in r ? [{ key: ref.key, entity: r.entity }] : [];
  });
  if (!items.length) return finish();
  send({
    type: "status",
    message: `Asking Qloo how ${audience.performer ? `${audience.performer.name}'s fans feel` : `${audience.label.toLowerCase()} feels`} about ${items.length} references${audience.cities.some((c) => c.lat !== undefined) ? ", and where each one is liked most" : ""}`,
  });
  const measured = await measure(qloo, items, audience);

  for (const item of items) {
    const m = measured.get(item.key);
    if (!m) continue;
    const ref = references.find((r) => r.key === item.key)!;
    const { verdict, reasons } = judge(m, item.entity.types[0] ?? "", ref.extracted.weight);
    update(item.key, {
      signals: { recognition: m.recognition, roomIndex: m.roomIndex, age: m.profile?.age, cities: m.cities },
      verdict,
      reasons,
    });
  }
  const counts = references.reduce<Record<string, number>>((c, r) => ({ ...c, [r.verdict]: (c[r.verdict] ?? 0) + 1 }), {});
  send({
    type: "status",
    message: `${counts.lands ?? 0} land, ${counts.risky ?? 0} risky, ${counts.dead ?? 0} won't land`,
  });

  // Local hooks run alongside the swap search.
  const placed = audience.cities.filter((c) => c.lat !== undefined);
  const hooksDone = placed.length
    ? Promise.all(placed.map((c) => localHooks(qloo, c, audience.ageMix, audience.fansOf).catch(() => undefined))).then((found) => {
        hooks = found.filter((h): h is LocalHooks => !!h);
        if (hooks.length) send({ type: "hooks", hooks });
      })
    : Promise.resolve();

  // 4. Look for substitutes for the weak references the line depends on.
  const weak = references
    .filter((r) => (r.verdict === "dead" || r.verdict === "risky") && r.resolution.entity && r.spans.length)
    .filter((r) => r.verdict === "dead" || r.extracted.weight !== "color")
    // A line that states a fact about this person or thing can't trade it
    // for another without saying something false.
    .filter((r) => r.extracted.swappable !== false)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_SWAP_REFERENCES);
  if (weak.length && deferSwaps && mode === "live" && anthropic) {
    swapTargets = weak.map((r) => r.key);
  } else if (weak.length) {
    const recorded = mode === "replay" && sample ? RECORDED_SWAPS[sample.id] : undefined;
    const remaining = deadline - Date.now();
    if (!recorded && anthropic && remaining < MIN_SWAP_MS) {
      send({ type: "status", message: "Out of time to look for swaps on this run" });
    } else if (recorded || anthropic) {
      // Examples only re-check the swaps recorded for them.
      const searching = recorded ? weak.filter((r) => recorded[r.extracted.name]) : weak;
      if (searching.length) {
        send({ type: "status", message: `Looking for swaps that do the same job for ${searching.map((r) => r.extracted.name).join(", ")}` });
      }
      // Stops the swap agents at the deadline, or when the visitor leaves.
      const swapAbort = new AbortController();
      const stop = () => swapAbort.abort();
      llm.signal?.addEventListener("abort", stop, { once: true });
      const timer = setTimeout(stop, remaining);
      const swapLlm: LlmOptions = { ...llm, signal: swapAbort.signal };
      await Promise.all(
        weak.map(async (ref) => {
          const ctx = swapContext(text, ref, audience, references.filter((r) => r.key !== ref.key).map((r) => r.extracted.name));
          try {
            const result = recorded ? await replaySwaps(qloo, ctx, recorded[ref.extracted.name]) : await runSwapAgent(anthropic!, qloo, ctx, swapLlm);
            update(ref.key, toPatch(result));
          } catch (err) {
            if (llm.signal?.aborted) return;
            if (swapAbort.signal.aborted) update(ref.key, { swapNote: "Ran out of time before a swap was confirmed." });
            else console.error(`swap agent failed for ${ref.extracted.name}`, err);
          }
        }),
      );
      clearTimeout(timer);
      llm.signal?.removeEventListener("abort", stop);
    }
  }
  await hooksDone;
  await finish();
}

const MAX_SWAP_REFERENCES = 4;
const rank = (r: AnalyzedReference) =>
  (r.verdict === "dead" ? 0 : 3) + { punchline: 0, setup: 1, color: 2 }[r.extracted.weight];

const toPatch = (result: SwapResult): Partial<AnalyzedReference> => ({
  swaps: result.swaps.map(({ checked, rewrite, why }) => ({
    entity: { id: checked.id, name: checked.name, type: checked.type },
    signals: { recognition: checked.presence, roomIndex: checked.room_index },
    verdict: checked.verdict,
    rewrite,
    why,
  })),
  swapNote: result.note,
});

// One live swap search, as its own request: the reference as measured, the
// script, the room, and what else the script mentions.
export async function runSwapSearch(
  input: { text: string; presetId: string; cities: string[]; performerId?: string; reference: AnalyzedReference; others: string[] },
  options: { signal?: AbortSignal; meter?: UsageMeter } = {},
): Promise<Pick<AnalyzedReference, "swaps" | "swapNote">> {
  const anthropic = getAnthropic();
  const qloo = getQlooClient();
  if (!anthropic || !qloo) throw new UserFacingError("Live swaps aren't switched on.");
  const meter = options.meter ?? new UsageMeter();
  const { audience } = await buildAudience(input);
  const ctx = swapContext(normalize(input.text), input.reference, audience, input.others);
  // Stop before the host's limit; a partial answer beats a dropped request.
  const abort = new AbortController();
  options.signal?.addEventListener("abort", () => abort.abort(), { once: true });
  const timer = setTimeout(() => abort.abort(), BUDGET_MS);
  try {
    const patch = toPatch(await runSwapAgent(anthropic, qloo, ctx, { signal: abort.signal, onUsage: meter.record }));
    return { swaps: patch.swaps ?? [], swapNote: patch.swapNote };
  } catch (err) {
    if (abort.signal.aborted && !options.signal?.aborted) return { swaps: [], swapNote: "Ran out of time before a swap was confirmed." };
    throw err;
  } finally {
    clearTimeout(timer);
    if (!meter.empty) console.info("llm usage (swap)", JSON.stringify(meter.summary()));
  }
}

export function swapContext(text: string, ref: AnalyzedReference, audience: AudienceSpec, others: string[]): SwapContext {
  const entity = ref.resolution.entity!;
  return {
    original: {
      id: entity.id,
      name: ref.extracted.name,
      entity_name: entity.name,
      stand_in: ref.resolution.standIn,
      type: entity.type,
      kind: ref.extracted.kind,
      role: ref.extracted.role,
      weight: ref.extracted.weight,
      quotes: ref.extracted.quotes,
      line: passageAround(text, ref.spans),
      context: paragraphAround(text, ref.spans[0].start),
      verdict: ref.verdict,
      reasons: ref.reasons,
      room_index: ref.signals?.roomIndex,
      presence: ref.signals?.recognition,
    },
    audience: {
      label: audience.label,
      ageMix: audience.ageMix,
      cities: audience.cities,
      performer: audience.performer && audience.fansOf ? { id: audience.fansOf, name: audience.performer.name } : undefined,
    },
    others,
    checked: {},
  };
}

// Re-checks recorded substitutes against live Qloo and keeps those that still land.
async function replaySwaps(qloo: QlooClient, ctx: SwapContext, recorded: { swaps: RecordedSwap[]; note: string } | undefined): Promise<SwapResult> {
  if (!recorded) return { swaps: [], note: "" };
  const found = await Promise.all(
    recorded.swaps.map(async (s) => {
      const hit = (await search(qloo, s.name, { types: [s.type as EntityType], take: 8 })).find(
        (e) => e.name === s.name && (s.year === undefined || e.releaseYear === s.year),
      );
      return hit ? { hit, s } : undefined;
    }),
  );
  const present = found.filter((f): f is NonNullable<typeof f> => !!f);
  if (!present.length) return { swaps: [], note: recorded.note };
  const checked = await check(qloo, ctx, { ids: present.map((p) => p.hit.id) });
  const swaps = present.flatMap(({ hit, s }) => {
    const c = checked.find((x) => x.id === hit.id);
    return c?.beats_original ? [{ checked: c, rewrite: s.rewrite, why: s.why }] : [];
  });
  // Recorded for the example's own room; in another room they may not win.
  const note = swaps.length || !recorded.swaps.length ? recorded.note : "The swaps recorded for this example don't beat the original for this room.";
  return { swaps, note };
}
