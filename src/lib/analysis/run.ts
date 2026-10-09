import Anthropic from "@anthropic-ai/sdk";
import { RECORDED_EXTRACTIONS } from "@/content/extractions";
import { RECORDED_PICKS } from "@/content/extractions/picks";
import { SAMPLES } from "@/content/samples";
import { AUDIENCE_PRESETS, presetById } from "../audience/audience";
import { findCity } from "../geo/cities";
import { RECORDED_SWAPS, type RecordedSwap } from "@/content/extractions/swaps";
import { search, type EntityType, type QlooEntity } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import { getQlooClient } from "../qloo/server";
import { chooseCandidates } from "./choose";
import { extractReferences, type Extraction } from "./extract";
import { measure } from "./measure";
import { buildReferences, paragraphAround, passageAround } from "./references";
import { findCandidates, pickCandidate, toSummary, type Pick } from "./resolve";
import { runSwapAgent, type SwapResult } from "./swap-agent";
import { check, type SwapContext } from "./swap-tools";
import { localHooks } from "./hooks";
import type { AnalysisEvent, AnalyzedReference, AudienceSpec, LocalHooks } from "./types";
import { judge } from "./verdict";

export interface AnalysisInput {
  text: string;
  presetId: string;
  cities: string[];
}

// Errors whose message is safe and useful to show the user as-is.
export class UserFacingError extends Error {}

const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();

type Resolution = { entity: QlooEntity; standIn?: string } | { candidates: QlooEntity[] } | null;

export async function runAnalysis(input: AnalysisInput, send: (event: AnalysisEvent) => void) {
  const text = normalize(input.text);
  const preset = presetById(input.presetId) ?? AUDIENCE_PRESETS[0];
  const cities = input.cities.map((name) => ({ name, match: findCity(name) }));
  const unknown = cities.filter((c) => !c.match).map((c) => c.name);
  if (unknown.length) {
    send({ type: "status", message: `Couldn't place ${unknown.join(", ")} on the map; city checks will skip ${unknown.length > 1 ? "them" : "it"}` });
  }
  const audience: AudienceSpec = {
    presetId: preset.id,
    label: preset.label,
    ageMix: preset.ageMix,
    cities: cities.map(({ name, match }) => (match ? { name: match.label, lat: match.lat, lon: match.lon } : { name })),
  };

  // 1. Find the references.
  const sample = SAMPLES.find((s) => normalize(s.text) === text);
  const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  let extraction: Extraction;
  let mode: "live" | "replay";
  if (sample && RECORDED_EXTRACTIONS[sample.id]) {
    send({ type: "status", message: "Reading the script (recorded example)" });
    extraction = RECORDED_EXTRACTIONS[sample.id];
    mode = "replay";
  } else if (anthropic) {
    send({ type: "status", message: "Reading the script" });
    extraction = await extractReferences(anthropic, text);
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
  const finish = () => send({ type: "done", analysis: { text, audience, references, mode, hooks } });

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
      return { ref, candidates, pick: pickCandidate(ref.extracted, candidates) as Pick };
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
        );
        for (const p of picks) {
          const entry = ambiguous.find((a) => a.ref.key === p.id);
          if (!entry) continue;
          const entity = p.choice === null ? undefined : entry.candidates[p.choice];
          resolutions.set(p.id, entity ? { entity, standIn: p.stand_in ? p.note : undefined } : null);
        }
      } catch (err) {
        console.error("candidate matching failed", err);
      }
    }
  }

  for (const ref of checkable) {
    const r = resolutions.get(ref.key);
    if (r && "entity" in r) update(ref.key, { resolution: { status: "resolved", entity: toSummary(r.entity), standIn: r.standIn } });
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
    message: `Asking Qloo how ${preset.label.toLowerCase()} feels about ${items.length} references${audience.cities.some((c) => c.lat !== undefined) ? ", city by city" : ""}`,
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
    ? Promise.all(placed.map((c) => localHooks(qloo, c, audience.ageMix).catch(() => undefined))).then((found) => {
        hooks = found.filter((h): h is LocalHooks => !!h);
        if (hooks.length) send({ type: "hooks", hooks });
      })
    : Promise.resolve();

  // 4. Look for substitutes for the weak references the line depends on.
  const weak = references
    .filter((r) => (r.verdict === "dead" || r.verdict === "risky") && r.resolution.entity && r.spans.length)
    .filter((r) => r.verdict === "dead" || r.extracted.weight !== "color")
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_SWAP_REFERENCES);
  if (weak.length) {
    const recorded = mode === "replay" && sample ? RECORDED_SWAPS[sample.id] : undefined;
    if (recorded || anthropic) {
      send({ type: "status", message: `Looking for swaps that do the same job for ${weak.map((r) => r.extracted.name).join(", ")}` });
      await Promise.all(
        weak.map(async (ref) => {
          const ctx = swapContext(text, ref, audience, references);
          try {
            const result = recorded ? await replaySwaps(qloo, ctx, recorded[ref.extracted.name]) : await runSwapAgent(anthropic!, qloo, ctx);
            update(ref.key, {
              swaps: result.swaps.map(({ checked, rewrite, why }) => ({
                entity: { id: checked.id, name: checked.name, type: checked.type },
                signals: { recognition: checked.presence, roomIndex: checked.room_index },
                verdict: checked.verdict,
                rewrite,
                why,
              })),
              swapNote: result.note,
            });
          } catch (err) {
            console.error(`swap agent failed for ${ref.extracted.name}`, err);
          }
        }),
      );
    }
  }
  await hooksDone;
  finish();
}

const MAX_SWAP_REFERENCES = 4;
const rank = (r: AnalyzedReference) =>
  (r.verdict === "dead" ? 0 : 3) + { punchline: 0, setup: 1, color: 2 }[r.extracted.weight];

function swapContext(text: string, ref: AnalyzedReference, audience: AudienceSpec, all: AnalyzedReference[]): SwapContext {
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
    audience: { label: audience.label, ageMix: audience.ageMix, cities: audience.cities },
    others: all.filter((r) => r.key !== ref.key).map((r) => r.extracted.name),
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
  return {
    swaps: present.flatMap(({ hit, s }) => {
      const c = checked.find((x) => x.id === hit.id);
      return c?.beats_original ? [{ checked: c, rewrite: s.rewrite, why: s.why }] : [];
    }),
    note: recorded.note,
  };
}
