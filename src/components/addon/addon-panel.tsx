"use client";

import { ArrowLeft, ArrowRight, Check, ChevronRight, Eraser, Highlighter, LoaderCircle, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DOCS_TEMPLATE_URL } from "@/content/addon";
import { SAMPLES, type SampleScript } from "@/content/samples";
import { AUDIENCE_PRESETS, presetById } from "@/lib/audience/audience";
import type { AnalyzedReference, Verdict } from "@/lib/analysis/types";
import { DOC_COLOR, docChange, docMarks, reverseChange, type DocChange } from "@/lib/ui/doc-ops";
import { planEdit } from "@/lib/ui/document";
import { roomScore } from "@/lib/ui/score";
import { EXAMPLE_ORDER, MAX_CHARS } from "../composer";
import { Inspector } from "../inspector";
import { VERDICT_LABEL, WEIGHT_LABEL } from "../labels";
import { PerformerPicker, type PerformerRoomData } from "../performer-picker";
import { ScopeNote } from "../summary";
import { AgeHistogram, CityChips, CityInput, MAX_CITIES } from "../room-picker";
import { useAnalysis } from "../use-analysis";
import { VerdictIcon } from "../verdict";
import { useDocBridge, type DocScript } from "./doc-bridge";

interface Room {
  presetId: string;
  cities: string[];
  performerId?: string;
}

// What was sent for checking: the text as the server reads it, and where it
// starts in the document.
interface Source {
  text: string;
  base: number;
  selection: boolean;
}

interface Taken {
  index: number;
  change: DocChange;
}

type Group = Verdict | "pending";
const GROUPS: { id: Group; title: string }[] = [
  { id: "dead", title: VERDICT_LABEL.dead },
  { id: "risky", title: VERDICT_LABEL.risky },
  { id: "lands", title: VERDICT_LABEL.lands },
  { id: "unchecked", title: VERDICT_LABEL.unchecked },
  { id: "pending", title: "Checking" },
];
const groupOf = (r: AnalyzedReference): Group => (r.resolution.status === "pending" ? "pending" : r.verdict);

const without = <T,>(record: Record<string, T>, key: string) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">{children}</h2>;
}

function Brand() {
  return (
    <Link href="/" target="_blank" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
      <span className="size-2 rounded-full bg-accent-glow shadow-[0_0_12px_3px_color-mix(in_srgb,var(--accent-glow)_55%,transparent)]" aria-hidden />
      Whoosh
    </Link>
  );
}

function Outside() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Brand />
      <h1 className="text-2xl font-semibold tracking-tight">Whoosh for Google Docs</h1>
      <p className="text-sm leading-relaxed text-ink-soft">
        This panel runs inside Google Docs, next to your script. It marks every reference with how your room will read it and puts the swaps you
        pick straight into the document.
      </p>
      <p className="text-sm leading-relaxed text-ink-soft">
        {DOCS_TEMPLATE_URL ? (
          <>
            To try it,{" "}
            <a href={DOCS_TEMPLATE_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              make a copy of the Whoosh template
            </a>
            , then choose <strong>Whoosh → Check this room</strong> in your copy.
          </>
        ) : (
          <>
            To set it up, add the add-on&apos;s files to a document&apos;s Apps Script project (see addons/google-docs in the repository), then
            choose <strong>Whoosh → Check this room</strong>.
          </>
        )}
      </p>
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        Or use the web app →
      </Link>
    </div>
  );
}

export function AddonPanel() {
  const bridge = useDocBridge();
  const { state, run, reset } = useAnalysis();
  const [presetId, setPresetId] = useState("general");
  const [performer, setPerformer] = useState<PerformerRoomData>();
  const [cities, setCities] = useState<string[]>([]);
  const [source, setSource] = useState<Source>();
  const [openKey, setOpenKey] = useState<string>();
  const [taken, setTaken] = useState<Record<string, Taken>>({});
  const [notice, setNotice] = useState<string>();
  const [marked, setMarked] = useState(true);
  const [busy, setBusy] = useState(false);

  const preset = presetById(presetId);
  const roomLabel = performer ? `Fans of ${performer.performer.name}` : (preset?.label ?? "");
  const mix = performer ? performer.ageMix : preset?.ageMix;
  const refs = state.references;
  const byKey = useMemo(() => new Map(refs.map((r) => [r.key, r])), [refs]);
  const connected = bridge.state === "connected";
  const call = bridge.call;

  // The marks in the document follow the verdicts as they come in. Words a
  // swap put in keep their color; the words it replaced aren't there to mark.
  const marks = useMemo(() => {
    if (!source) return [];
    const swapped = Object.values(taken).flatMap(({ change }) =>
      change.ops.filter((op) => op.insert).map((op) => ({ quote: op.insert, at: change.at + op.at, color: change.color ?? DOC_COLOR.lands })),
    );
    return [...docMarks(source.text, refs, source.base, new Set(Object.keys(taken))), ...swapped];
  }, [source, refs, taken]);
  const markKey = JSON.stringify(marks.map((m) => [m.at, m.color]));

  useEffect(() => {
    if (!marked || !connected || !marks.length) return;
    const t = setTimeout(() => call("paint", marks).catch(() => undefined), 400);
    return () => clearTimeout(t);
    // markKey stands in for marks: repaint only when a position or color changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markKey, marked, connected, call]);

  const addCity = (name: string) => {
    if (cities.length < MAX_CITIES && !cities.some((c) => c.toLowerCase() === name.toLowerCase())) setCities([...cities, name]);
  };

  const check = async (room: Room = { presetId, cities, performerId: performer?.performer.id }) => {
    setNotice(undefined);
    let script: DocScript;
    try {
      script = await call<DocScript>("getScript");
    } catch (err) {
      setNotice(message(err));
      return;
    }
    const text = script.text.trim();
    const what = script.selection ? "The selection" : "This document";
    if (!text) {
      setNotice(script.selection ? "The selection has no text." : "This document is empty. Write or paste your script, or try an example below.");
      return;
    }
    if (text.length > MAX_CHARS) {
      setNotice(
        `${what} has ${text.length.toLocaleString("en-US")} characters; Whoosh checks up to ${MAX_CHARS.toLocaleString("en-US")} at a time. Select the part you'll say out loud, then check again.`,
      );
      return;
    }
    setSource({ text, base: script.base + (script.text.length - script.text.trimStart().length), selection: script.selection });
    setTaken({});
    setOpenKey(undefined);
    setMarked(true);
    call("clear").catch(() => undefined);
    run({ text, ...room });
  };

  const tryExample = async (sample: SampleScript) => {
    setNotice(undefined);
    try {
      await call("insertExample", sample.text);
    } catch (err) {
      setNotice(message(err));
      return;
    }
    setPerformer(undefined);
    setPresetId(sample.presetId);
    setCities(sample.cities);
    await check({ presetId: sample.presetId, cities: sample.cities });
  };

  const back = () => {
    call("clear").catch(() => undefined);
    reset();
    setSource(undefined);
    setTaken({});
    setOpenKey(undefined);
    setNotice(undefined);
  };

  const open = (key: string) => {
    setOpenKey(key);
    const ref = byKey.get(key);
    const span = ref?.spans[0];
    if (!source || !ref || !span) return;
    // Selecting the words scrolls the document to them.
    const at = taken[key] ? taken[key].change.at : source.base + span.start;
    const quote = taken[key]?.change.ops.find((op) => op.insert)?.insert ?? source.text.slice(span.start, span.end);
    call("select", { quote, at }).catch(() => undefined);
  };

  const step = (delta: number) => {
    if (!refs.length) return;
    const index = Math.max(0, refs.findIndex((r) => r.key === openKey));
    open(refs[(index + delta + refs.length) % refs.length].key);
  };

  // Puts a swap into the document, taking out a different swap for the same
  // reference first.
  const accept = async (key: string, index: number) => {
    const ref = byKey.get(key);
    const edit = ref && source && planEdit(source.text, ref, ref.swaps[index]);
    if (!ref || !source || !edit) return;
    setBusy(true);
    setNotice(undefined);
    try {
      const previous = taken[key];
      if (previous) {
        await call("apply", reverseChange(previous.change, DOC_COLOR[ref.verdict]));
        setTaken((t) => without(t, key));
      }
      const change = docChange(edit, source.base, DOC_COLOR[ref.swaps[index].verdict]);
      await call("apply", change);
      setTaken((t) => ({ ...t, [key]: { index, change } }));
    } catch (err) {
      setNotice(message(err));
    } finally {
      setBusy(false);
    }
  };

  const undo = async (key: string) => {
    const ref = byKey.get(key);
    const previous = taken[key];
    if (!ref || !previous) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await call("apply", reverseChange(previous.change, DOC_COLOR[ref.verdict]));
      setTaken((t) => without(t, key));
    } catch (err) {
      setNotice(message(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleMarks = () => {
    if (marked) call("clear").catch(() => undefined);
    setMarked(!marked);
  };

  if (bridge.state === "outside") return <Outside />;

  const noticeBox = notice && (
    <p role="alert" className="rounded-xl bg-dead-tint px-3 py-2.5 text-xs leading-relaxed text-dead-ink">
      {notice}
    </p>
  );

  if (state.phase === "idle") {
    return (
      <div className="flex flex-col gap-6 p-4">
        <div className="flex flex-col gap-2">
          <Brand />
          <p className="text-xs leading-relaxed text-ink-soft">
            Checks the shows, people, music, brands and places your script leans on against the room you pick, and finds swaps for the ones that
            won&apos;t land.
          </p>
        </div>
        <section>
          <label htmlFor="room" className="mb-2 block text-sm font-semibold">
            Who&apos;s in the room?
          </label>
          <select
            id="room"
            value={performer ? "" : presetId}
            onChange={(e) => {
              setPerformer(undefined);
              setPresetId(e.target.value);
            }}
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-focus"
          >
            {performer && <option value="">Fans of {performer.performer.name}</option>}
            {AUDIENCE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {!performer && preset && (
            <div className="mt-2.5 flex flex-col gap-2">
              <p className="text-xs text-ink-soft">{preset.description}</p>
              <AgeHistogram mix={preset.ageMix} className="h-7" labels />
            </div>
          )}
          <p className="mb-2 mt-4 text-xs text-ink-soft">Or a performer&apos;s crowd</p>
          <PerformerPicker room={performer} onChange={setPerformer} cities={cities} onAddCity={addCity} canAddCity={cities.length < MAX_CITIES} />
        </section>

        <section>
          <label htmlFor="city-input" className="mb-1 block text-sm font-semibold">
            Where are you playing?
          </label>
          <p className="mb-2 text-xs text-ink-soft">Optional. Up to {MAX_CITIES} cities.</p>
          <CityInput cities={cities} onAdd={addCity} />
          <CityChips cities={cities} onRemove={(city) => setCities(cities.filter((c) => c !== city))} />
        </section>

        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={!connected}
            onClick={() => check()}
            className="group flex items-center justify-center gap-2 rounded-2xl bg-cta px-4 py-3 text-sm font-semibold text-cta-ink transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {connected ? (
              <>
                Check this document
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </>
            ) : (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Connecting to the document…
              </>
            )}
          </button>
          <p className="text-xs leading-relaxed text-ink-faint">
            Select part of the document first to check only that part. Up to {MAX_CHARS.toLocaleString("en-US")} characters.
          </p>
          {noticeBox}
        </section>

        <section>
          <Heading>Or try an example in an empty document</Heading>
          <ul className="flex flex-col gap-1.5">
            {EXAMPLE_ORDER.map((id) => SAMPLES.find((s) => s.id === id)!).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => tryExample(s)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-left transition-colors hover:border-ink-faint hover:bg-sunk disabled:opacity-40"
                >
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="block text-[11px] text-ink-faint">
                    {s.format} · {presetById(s.presetId)?.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const running = state.phase === "running";
  const opened = openKey ? byKey.get(openKey) : undefined;

  if (opened) {
    const index = refs.indexOf(opened);
    return (
      <div className="flex flex-col gap-4 p-4">
        <button type="button" onClick={() => setOpenKey(undefined)} className="flex items-center gap-1 self-start text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden />
          All references
        </button>
        {noticeBox}
        {busy && (
          <p role="status" className="flex items-center gap-2 text-xs text-ink-soft">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            Updating the document…
          </p>
        )}
        <div className={busy ? "pointer-events-none opacity-60" : ""}>
          <Inspector
            reference={opened}
            index={index}
            total={refs.length}
            onStep={step}
            mix={mix}
            text={source?.text ?? ""}
            accepted={taken[opened.key]?.index}
            onAccept={(i) => accept(opened.key, i)}
            onUndo={() => undo(opened.key)}
            swapPending={state.swapsPending.includes(opened.key)}
          />
        </div>
      </div>
    );
  }

  const score = roomScore(refs.map((r) => ({ verdict: r.verdict, weight: r.extracted.weight })));
  const projected = roomScore(
    refs.map((r) => ({ verdict: taken[r.key] ? r.swaps[taken[r.key].index].verdict : r.verdict, weight: r.extracted.weight })),
  );
  const shown = Object.keys(taken).length ? projected : score;
  const counts = { lands: 0, risky: 0, dead: 0, unchecked: 0 } as Record<Verdict, number>;
  for (const r of refs) if (r.resolution.status !== "pending") counts[taken[r.key] ? r.swaps[taken[r.key].index].verdict : r.verdict]++;
  const total = counts.lands + counts.risky + counts.dead + counts.unchecked;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden />
          Change room
        </button>
        {refs.length > 0 && (
          <button
            type="button"
            onClick={toggleMarks}
            className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-ink-faint hover:text-ink"
          >
            {marked ? <Eraser className="size-3.5" aria-hidden /> : <Highlighter className="size-3.5" aria-hidden />}
            {marked ? "Clear highlights" : "Highlight again"}
          </button>
        )}
      </div>

      <div>
        <p className="text-lg font-semibold leading-tight tracking-tight">
          {roomLabel}
          {cities.length > 0 && <span className="font-normal text-ink-soft"> in {cities.map((c) => c.split(",")[0]).join(", ")}</span>}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">{source?.selection ? "Checking your selection" : "Checking the whole document"}</p>
      </div>

      <section className="card rounded-2xl p-4" aria-busy={running}>
        <div className="flex items-end gap-2">
          <p className="text-4xl font-semibold leading-none tracking-tight" aria-live="polite">
            {shown === undefined ? "–" : Math.round(shown * 100)}
            <span className="text-xl text-ink-faint">%</span>
          </p>
          <p className="mb-0.5 text-xs leading-snug text-ink-soft">
            should land{Object.keys(taken).length > 0 && score !== undefined && <span className="text-ink-faint"> (was {Math.round(score * 100)}%)</span>}
          </p>
        </div>
        {total > 0 && (
          <div className="mt-3 flex h-1.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
            {(["lands", "risky", "dead", "unchecked"] as const)
              .filter((v) => counts[v] > 0)
              .map((v) => (
                <span key={v} className={{ lands: "bg-lands", risky: "bg-risky", dead: "bg-dead", unchecked: "bg-quiet/40" }[v]} style={{ flexGrow: counts[v] }} />
              ))}
          </div>
        )}
        <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
          {(["lands", "risky", "dead", "unchecked"] as const).map((v) => (
            <li key={v} className="flex items-center gap-1">
              <VerdictIcon verdict={v} className="size-3" />
              {VERDICT_LABEL[v]} <span className="font-semibold tabular-nums text-ink">{counts[v]}</span>
            </li>
          ))}
        </ul>
        {state.phase === "done" && <ScopeNote count={refs.length} text={source?.text ?? ""} />}
      </section>

      {(running || state.swapsPending.length > 0) && (
        <p role="status" className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
          <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin text-accent" aria-hidden />
          {state.statuses.at(-1) ?? "Finding the references…"}
        </p>
      )}
      {state.phase === "error" && (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-xl bg-dead-tint px-3 py-2.5 text-xs text-dead-ink">
          <p>{state.error}</p>
          <button type="button" onClick={() => check()} className="flex items-center gap-1 rounded-full border border-dead/40 px-2.5 py-1 font-medium hover:bg-dead/10">
            <RotateCw className="size-3" aria-hidden />
            Try again
          </button>
        </div>
      )}
      {noticeBox}

      {GROUPS.map(({ id, title }) => {
        const list = refs.filter((r) => groupOf(r) === id);
        if (!list.length) return null;
        return (
          <section key={id}>
            <Heading>
              {title} · {list.length}
            </Heading>
            <ul className="-mx-2 flex flex-col">
              {list.map((r) => {
                const swap = taken[r.key] && r.swaps[taken[r.key].index];
                const searching = state.swapsPending.includes(r.key);
                return (
                  <li key={r.key}>
                    <button type="button" onClick={() => open(r.key)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-sunk">
                      {swap ? (
                        <Check className="size-3.5 shrink-0 text-lands" strokeWidth={2.75} aria-label="Swapped" />
                      ) : (
                        <VerdictIcon verdict={r.verdict} pending={r.resolution.status === "pending"} className="size-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-medium ${swap ? "text-ink-faint line-through" : ""}`}>{r.extracted.name}</span>
                        <span className="block truncate text-[11px] text-ink-faint">
                          {swap ? (
                            <span className="font-medium text-lands-ink">Swapped for {swap.entity.name}</span>
                          ) : (
                            <>
                              {WEIGHT_LABEL[r.extracted.weight]}
                              {r.swaps.length > 0 && (
                                <>
                                  {" · "}
                                  <span className="font-medium text-ink">Try {r.swaps[0].entity.name}</span>
                                  {r.swaps.length > 1 && ` +${r.swaps.length - 1}`}
                                </>
                              )}
                              {searching && " · finding swaps…"}
                            </>
                          )}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {state.phase === "done" && !state.swapsPending.length && (
        <button
          type="button"
          onClick={() => check()}
          className="flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm text-ink-soft hover:border-ink-faint hover:text-ink"
        >
          <RotateCw className="size-3.5" aria-hidden />
          Check again
        </button>
      )}
      <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
        Numbers from Qloo&apos;s taste graph, describing audiences in aggregate. Click a reference to jump to it in the document.
      </p>
    </div>
  );
}
