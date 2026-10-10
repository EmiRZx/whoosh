"use client";

import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, MapPin, MousePointerClick, Undo2 } from "lucide-react";
import type { AgeMix } from "@/lib/audience/audience";
import type { AnalyzedReference, Signals, Swap } from "@/lib/analysis/types";
import { planEdit } from "@/lib/ui/document";
import { generations, type Generation } from "@/lib/ui/generations";
import { topBucket } from "@/lib/ui/gut";
import { AGE_BUCKETS } from "@/lib/qloo/api";
import { AgeChart } from "./age-chart";
import { EntityThumb } from "./entity-thumb";
import { AGE_LABELS, KIND_LABEL, shortCity, signed, WEIGHT_LABEL } from "./labels";
import { VerdictChip } from "./verdict";

export interface InspectorProps {
  reference?: AnalyzedReference;
  index: number;
  total: number;
  onStep: (delta: number) => void;
  mix?: AgeMix;
  text: string;
  accepted?: number;
  onAccept: (swapIndex: number) => void;
  onUndo: () => void;
  // Name of the reference whose accepted swap rewrote this one away.
  rewrittenBy?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-sunk px-3.5 py-3" title={hint}>
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1 text-3xl font-semibold tracking-tight">{children}</p>
    </div>
  );
}

function RoomIndex({ value }: { value?: number }) {
  if (value === undefined) return <span className="text-ink-faint">–</span>;
  const Arrow = value >= 0 ? ArrowUp : ArrowDown;
  return (
    <>
      {signed(value)}
      <Arrow className={`size-4 self-center ${value >= 0 ? "text-more" : "text-less"}`} strokeWidth={2.75} aria-hidden />
    </>
  );
}

function CityRanks({ cities }: { cities: NonNullable<Signals["cities"]> }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {cities.map((c) => (
        <li
          key={c.name}
          className="flex items-center gap-1 rounded-full bg-sunk px-2.5 py-1 text-xs"
          title={`Ranks #${c.rank} of ${c.of} big cities for this`}
        >
          <MapPin className="size-3 text-ink-faint" aria-hidden />
          {shortCity(c.name)}
          <span className="font-semibold tabular-nums">#{c.rank}</span>
          <span className="text-ink-faint">/{c.of}</span>
        </li>
      ))}
    </ul>
  );
}

const TYPE_NAME: Record<string, string> = {
  "urn:entity:movie": "movie",
  "urn:entity:tv_show": "TV show",
  "urn:entity:artist": "music artist",
  "urn:entity:person": "person",
  "urn:entity:brand": "brand",
  "urn:entity:book": "book",
  "urn:entity:author": "author",
  "urn:entity:videogame": "video game",
  "urn:entity:podcast": "podcast",
  "urn:entity:place": "place",
  "urn:entity:locality": "place",
  "urn:entity:destination": "destination",
};

const squash = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
// False when Qloo measured something named differently ("Motorola" for
// "Motorola Razr"), so the inspector can say what was actually measured.
const sameName = (a: string, b: string) => squash(a) === squash(b);

// When Qloo has nothing, the model's blind guess is the only read there is.
function GutOnly({ reference }: { reference: AnalyzedReference }) {
  const gut = reference.gut!;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <VerdictChip verdict={gut.verdict} />
        <span className="text-ink-soft">
          this room {signed(gut.roomIndex)} vs. average · biggest fans {ageLabel(gut.fans)}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        <span className="italic">&ldquo;{gut.reason}&rdquo;</span> Claude&apos;s call without data, since Qloo has none for this one. Treat it as a
        second opinion, not a measurement.
      </p>
    </div>
  );
}

const FEELING_STYLE: Record<Generation["feeling"], string> = {
  "big fans": "text-more",
  "like it": "text-more",
  "about average": "text-ink-soft",
  lukewarm: "text-less",
  cool: "text-less",
};

// "Under 30: cool · 55+: big fans" for rooms that span generations.
function Generations({ age, mix }: { age: NonNullable<Signals["age"]>; mix: AgeMix }) {
  const gens = generations(age, mix);
  if (!gens.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-ink-soft">Across this room</p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {gens.map((g) => (
          <li key={g.label} className="rounded-lg bg-sunk px-2.5 py-1.5 text-xs" title={`${Math.round(g.share * 100)}% of the room`}>
            <span className="block text-ink-faint">
              {g.label} · {Math.round(g.share * 100)}%
            </span>
            <span className={`font-semibold ${FEELING_STYLE[g.feeling]}`}>{g.feeling}</span>{" "}
            <span className="tabular-nums text-ink-soft">{signed(g.index)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A next step for a weak reference the swap agent didn't (or couldn't) fix.
function advice(r: AnalyzedReference): string | undefined {
  if (r.verdict === "dead") return "Hardly anyone in this room will get it. Cut it, or reword the line so it works without knowing the reference.";
  if (r.verdict !== "risky") return undefined;
  if (r.extracted.weight === "color") return "It's an aside here, so it's safe to keep; it just won't add much for this room.";
  if (r.reasons.some((x) => x.startsWith("They'll know it")))
    return "Most of the room will recognize it, but it won't excite them. Keep it if the line doesn't depend on it; if it's the punchline, consider a reference this room is warmer on.";
  return "Only part of this room will get it. If the line depends on it, add a few words of setup, or pick a better-known example.";
}

const ageLabel = (b?: string) => (b ? AGE_LABELS[AGE_BUCKETS.indexOf(b as (typeof AGE_BUCKETS)[number])] : "–");

// The model's blind guess next to what Qloo measured.
function GutCheck({ reference }: { reference: AnalyzedReference }) {
  const gut = reference.gut!;
  const same = gut.verdict === reference.verdict;
  const rows: [string, React.ReactNode, React.ReactNode][] = [
    ["Call", <VerdictChip key="g" verdict={gut.verdict} />, <VerdictChip key="d" verdict={reference.verdict} />],
    [
      "This room vs. average",
      signed(gut.roomIndex),
      reference.signals?.roomIndex === undefined ? "–" : signed(reference.signals.roomIndex),
    ],
    ["Biggest fans", ageLabel(gut.fans), ageLabel(topBucket(reference.signals?.age))],
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className={`text-sm font-medium ${same ? "text-ink-soft" : "text-accent"}`}>
        {same ? "The data backs the gut call." : "The data overturned the gut call."}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-ink-faint">
            <th className="pb-1.5 font-normal">
              <span className="sr-only">Signal</span>
            </th>
            <th className="pb-1.5 font-medium">Claude&apos;s gut</th>
            <th className="pb-1.5 font-medium">Qloo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, g, d]) => (
            <tr key={label} className="border-t border-line">
              <th scope="row" className="py-1.5 pr-2 text-left text-xs font-normal text-ink-soft">
                {label}
              </th>
              <td className="py-1.5 pr-2 tabular-nums">{g}</td>
              <td className="py-1.5 font-medium tabular-nums">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs leading-relaxed text-ink-soft">
        <span className="italic">&ldquo;{gut.reason}&rdquo;</span> Claude, before seeing any data.
      </p>
    </div>
  );
}

function SwapCard({
  swap,
  text,
  reference,
  accepted,
  onAccept,
  onUndo,
}: {
  swap: Swap;
  text: string;
  reference: AnalyzedReference;
  accepted: boolean;
  onAccept: () => void;
  onUndo: () => void;
}) {
  const edit = planEdit(text, reference, swap);
  const best = swap.signals.cities?.length ? [...swap.signals.cities].sort((a, b) => a.rank - b.rank)[0] : undefined;
  return (
    <li
      className={`rounded-xl border p-3.5 transition-colors ${
        accepted ? "border-lands/50 bg-lands-tint" : "border-card-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <EntityThumb src={swap.entity.imageUrl} name={swap.entity.name} className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="font-semibold">{swap.entity.name}</span>
            <VerdictChip verdict={swap.verdict} />
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {swap.signals.roomIndex !== undefined && <>This room {signed(swap.signals.roomIndex)}</>}
            {best && (
              <>
                {swap.signals.roomIndex !== undefined && " · "}#{best.rank} in {shortCity(best.name)}
              </>
            )}
          </p>
        </div>
      </div>
      {swap.why && <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{swap.why}</p>}
      <p className="mt-2.5 rounded-lg bg-sunk px-3 py-2 font-serif text-[15px] leading-relaxed">
        {edit
          ? edit.parts.map((part, i) =>
              part.kind === "same" ? (
                <span key={i}>{part.text}</span>
              ) : part.kind === "del" ? (
                <del key={i} className="swap-del">
                  {part.text}
                </del>
              ) : (
                <ins key={i} className="swap-ins cursor-auto">
                  {part.text}
                </ins>
              ),
            )
          : swap.rewrite}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {accepted ? (
          <>
            <span className="flex items-center gap-1 text-sm font-medium text-lands-ink">
              <Check className="size-4" strokeWidth={2.75} aria-hidden />
              In your script
            </span>
            <button
              type="button"
              onClick={onUndo}
              className="ml-auto flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
            >
              <Undo2 className="size-3.5" aria-hidden />
              Undo
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onAccept}
            disabled={!edit}
            className="rounded-full bg-cta px-3.5 py-1.5 text-xs font-semibold text-cta-ink transition-transform hover:-translate-y-px disabled:opacity-40"
          >
            Use this swap
          </button>
        )}
      </div>
    </li>
  );
}

export function Inspector(props: InspectorProps) {
  const { reference, index, total, onStep, mix, text, accepted, onAccept, onUndo, rewrittenBy } = props;

  if (!reference) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <MousePointerClick className="size-6 text-ink-faint" aria-hidden />
        <p className="text-lg font-semibold">Pick a reference</p>
        <p className="max-w-xs text-sm text-ink-soft">Click any highlighted name in the script to see how this room reads it.</p>
      </div>
    );
  }

  const { extracted, resolution } = reference;
  const status = resolution.status;
  const entity = resolution.entity;

  return (
    <div key={reference.key} className="flex animate-rise flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictChip verdict={reference.verdict} pending={status === "pending"} />
          <span className="text-xs text-ink-faint">
            {KIND_LABEL[extracted.kind]} · {WEIGHT_LABEL[extracted.weight]}
          </span>
        </div>
        <div className="flex items-center gap-0.5 text-xs text-ink-faint">
          <button type="button" onClick={() => onStep(-1)} aria-label="Previous reference" className="grid size-7 place-items-center rounded-full hover:bg-sunk hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="tabular-nums">
            {index + 1} of {total}
          </span>
          <button type="button" onClick={() => onStep(1)} aria-label="Next reference" className="grid size-7 place-items-center rounded-full hover:bg-sunk hover:text-ink">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <header className="flex items-start gap-3.5">
        <EntityThumb src={entity?.imageUrl} name={extracted.name} />
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">{extracted.name}</h2>
          {(extracted.disambiguation ?? entity?.description) && (
            <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{extracted.disambiguation ?? entity?.description}</p>
          )}
          {entity && sameName(entity.name, extracted.name) === false && (
            <p className="mt-1.5 text-xs text-ink-faint">
              Measured as <span className="font-medium text-ink-soft">{entity.name}</span> ({TYPE_NAME[entity.type] ?? "entity"})
            </p>
          )}
        </div>
      </header>

      {resolution.standIn && (
        <p className="rounded-lg bg-sunk px-3 py-2 text-xs text-ink-soft">Measured through a stand-in: {resolution.standIn}.</p>
      )}
      {rewrittenBy && (
        <p className="rounded-lg bg-lands-tint px-3 py-2 text-xs text-lands-ink">Your swap for {rewrittenBy} rewrote this line.</p>
      )}

      <Section title="Its job in the line">
        <p className="text-[15px] leading-relaxed">{extracted.role}</p>
      </Section>

      <Section title="How this room reads it">
        {status === "not_checkable" ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            {extracted.kind === "other" && !resolution.entity
              ? "Events, eras, memes and political figures aren't measured here (a taste graph doesn't hold the first three, and this tool doesn't measure political taste), so this one is your call."
              : "A political figure: this tool doesn't measure political taste, so this one is your call."}
          </p>
        ) : status === "pending" ? (
          <div className="flex flex-col gap-2" aria-busy>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="h-[74px] animate-shimmer rounded-xl bg-sunk" />
              <div className="h-[74px] animate-shimmer rounded-xl bg-sunk" />
            </div>
            <p className="text-sm text-ink-soft">Checking with Qloo…</p>
          </div>
        ) : status === "not_found" ? (
          <p className="text-sm leading-relaxed text-ink-soft">Qloo doesn&apos;t have this one, so it&apos;s your call.</p>
        ) : status === "ambiguous" ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Qloo has several things by this name and none was a clear match: {resolution.candidates?.map((c) => c.name).join(", ")}.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {reference.signals && (
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="This room vs. average" hint="How much more or less this room likes it than the average adult, from Qloo">
                  <RoomIndex value={reference.signals.roomIndex} />
                </Stat>
                <Stat label="Presence today" hint="Popularity percentile among things of its kind, from Qloo">
                  {reference.signals.recognition === undefined ? (
                    <span className="text-ink-faint">–</span>
                  ) : (
                    <>
                      {Math.round(reference.signals.recognition * 100)}
                      <span className="text-sm font-normal text-ink-faint">/100</span>
                    </>
                  )}
                </Stat>
              </div>
            )}
            {mix && reference.signals?.age && <Generations age={reference.signals.age} mix={mix} />}
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
              {reference.reasons.map((reason, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" aria-hidden />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {status !== "resolved" && status !== "not_checkable" && status !== "pending" && reference.gut && (
        <Section title="Claude's guess">
          <GutOnly reference={reference} />
        </Section>
      )}

      {status === "resolved" && !reference.swaps.length && advice(reference) && (
        <Section title="What to do">
          <p className="text-sm leading-relaxed">{advice(reference)}</p>
        </Section>
      )}

      {(reference.swaps.length > 0 || reference.swapNote) && (
        <Section title="Swaps that do the same job">
          {reference.swaps.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {reference.swaps.map((swap, i) => (
                <SwapCard
                  key={swap.entity.id}
                  swap={swap}
                  text={text}
                  reference={reference}
                  accepted={accepted === i}
                  onAccept={() => onAccept(i)}
                  onUndo={onUndo}
                />
              ))}
            </ul>
          )}
          {reference.swapNote && <p className="text-xs leading-relaxed text-ink-soft">{reference.swapNote}</p>}
        </Section>
      )}

      {status === "resolved" && reference.signals && (reference.signals.age || reference.signals.cities?.length) && (
        <Section title="Who likes it">
          {reference.signals.age && Object.keys(reference.signals.age).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-soft">Each age group vs. the average adult</p>
              <AgeChart age={reference.signals.age} mix={mix} />
            </div>
          )}
          {reference.signals.cities && reference.signals.cities.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-ink-soft">Where it ranks among {reference.signals.cities[0].of} big cities</p>
              <CityRanks cities={reference.signals.cities} />
            </div>
          )}
        </Section>
      )}

      {reference.gut && status === "resolved" && reference.verdict !== "unchecked" && (
        <Section title="Gut vs. data">
          <GutCheck reference={reference} />
        </Section>
      )}

      <p className="border-t border-line pt-3 text-[11px] text-ink-faint">
        Numbers from Qloo&apos;s taste graph, describing audiences in aggregate.
      </p>
    </div>
  );
}
