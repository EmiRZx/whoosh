"use client";

import { ArrowLeft, Check, Copy, FileText, Printer, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLES } from "@/content/samples";
import { presetById } from "@/lib/audience/audience";
import type { Verdict } from "@/lib/analysis/types";
import { composeDocument, overlaps, planEdit, type Edit } from "@/lib/ui/document";
import { setNotes } from "@/lib/ui/notes";
import { roomScore } from "@/lib/ui/score";
import { Composer } from "./composer";
import { GutVsData } from "./gut-vs-data";
import { Inspector } from "./inspector";
import { VERDICT_LABEL } from "./labels";
import { LocalHooksPanel } from "./local-hooks";
import { Report } from "./report";
import { ScriptView } from "./script-view";
import type { PerformerRoomData } from "./performer-picker";
import { AgentTrace, FixesCard, RoomCard, ScoreCard, VERDICT_ORDER, type RoomInfo } from "./summary";
import { TourMatrix } from "./tour-matrix";
import { saveLastRun, useLastRun, type LastRun } from "./last-run";
import { useAnalysis } from "./use-analysis";
import { VerdictIcon } from "./verdict";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

function ToolbarButton({ onClick, icon: Icon, children }: { onClick: () => void; icon: typeof Copy; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

export function Studio() {
  const [text, setText] = useState("");
  const [presetId, setPresetId] = useState("general");
  const [performer, setPerformer] = useState<PerformerRoomData>();
  const [cities, setCities] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [accepted, setAccepted] = useState<Record<string, number>>({});
  const [showChanges, setShowChanges] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flash, setFlash] = useState<string>();
  const { state, run, reset, restore } = useAnalysis();
  const lastRun = useLastRun();
  const inspectorBox = useRef<HTMLDivElement>(null);

  const sample = SAMPLES.find((s) => s.text === text);
  const preset = presetById(presetId);
  const room: RoomInfo | undefined = performer
    ? {
        label: `Fans of ${performer.performer.name}`,
        description: "Age mix from Qloo's data on their fans; their taste also steers the swaps and local hooks",
        ageMix: performer.ageMix,
        audience: `fans of ${performer.performer.name}`,
        imageUrl: performer.performer.imageUrl,
        name: performer.performer.name,
      }
    : preset && { label: preset.label, description: preset.description, ageMix: preset.ageMix, audience: `${preset.label.toLowerCase()} audiences` };
  const analysedText = state.analysis?.text ?? text.replace(/\r\n/g, "\n").trim();
  const refs = state.references;
  const byKey = useMemo(() => new Map(refs.map((r) => [r.key, r])), [refs]);

  const edits = useMemo(
    () =>
      Object.entries(accepted).flatMap(([key, i]): Edit[] => {
        const ref = byKey.get(key);
        const edit = ref?.swaps[i] && planEdit(analysedText, ref, ref.swaps[i]);
        return edit ? [edit] : [];
      }),
    [accepted, byKey, analysedText],
  );
  const doc = useMemo(() => composeDocument(analysedText, refs, edits), [analysedText, refs, edits]);
  const changed = edits.length > 0;

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { lands: 0, risky: 0, dead: 0, unchecked: 0 };
    // References still being checked aren't "not measured" yet.
    for (const r of refs) if (r.resolution.status !== "pending") c[r.verdict]++;
    return c;
  }, [refs]);
  const score = roomScore(refs.map((r) => ({ verdict: r.verdict, weight: r.extracted.weight })));
  // With swaps: each swapped reference takes its substitute's verdict, and
  // references a rewrite removed drop out.
  const projected = roomScore(
    refs
      .filter((r) => accepted[r.key] !== undefined || !doc.removed.has(r.key))
      .map((r) => ({
        verdict: accepted[r.key] !== undefined ? r.swaps[accepted[r.key]].verdict : r.verdict,
        weight: r.extracted.weight,
      })),
  );
  // The counts follow the script as it now reads: swapped references take
  // their substitute's verdict, rewritten-away ones drop out.
  const shownCounts = useMemo(() => {
    if (!changed) return counts;
    const c: Record<Verdict, number> = { lands: 0, risky: 0, dead: 0, unchecked: 0 };
    for (const r of refs) {
      if (accepted[r.key] !== undefined) c[r.swaps[accepted[r.key]].verdict]++;
      else if (!doc.removed.has(r.key)) c[r.verdict]++;
    }
    return c;
  }, [changed, counts, refs, accepted, doc.removed]);
  const checkable = refs.filter((r) => r.resolution.status !== "not_checkable");
  const progress = { done: checkable.filter((r) => r.resolution.status !== "pending").length, total: checkable.length };

  // Until the user picks one, show the first punchline so the inspector isn't empty.
  const activeKey = byKey.has(selectedKey ?? "")
    ? selectedKey
    : (refs.find((r) => r.extracted.weight === "punchline") ?? refs[0])?.key;
  const index = refs.findIndex((r) => r.key === activeKey);
  const selected = refs[index];
  const rewrittenBy =
    selected && doc.removed.has(selected.key) && accepted[selected.key] === undefined
      ? edits.find((e) => selected.spans.some((s) => s.start < e.to && e.from < s.end))?.refKey
      : undefined;

  const select = useCallback((key: string) => {
    setSelectedKey(key);
    setSheetOpen(true);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (!refs.length) return;
      const next = refs[(Math.max(0, index) + delta + refs.length) % refs.length];
      setSelectedKey(next.key);
    },
    [refs, index],
  );

  const jump = (verdict: Verdict) => {
    const list = refs.filter((r) => r.verdict === verdict);
    if (!list.length) return;
    const at = list.findIndex((r) => r.key === activeKey);
    select(list[(at + 1) % list.length].key);
  };

  const accept = (key: string, swapIndex: number) => {
    const ref = byKey.get(key);
    const edit = ref && planEdit(analysedText, ref, ref.swaps[swapIndex]);
    if (!edit) return;
    setAccepted((prev) => {
      const next: Record<string, number> = {};
      for (const e of edits) if (e.refKey !== key && !overlaps(e, edit)) next[e.refKey] = prev[e.refKey];
      next[key] = swapIndex;
      return next;
    });
  };

  const undo = (key: string) =>
    setAccepted((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  useEffect(() => {
    if (state.phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "j") step(1);
      else if (e.key === "ArrowLeft" || e.key === "k") step(-1);
      else if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, step]);

  // Keep the finished run (and the swaps taken) so a reload doesn't lose it.
  useEffect(() => {
    if (state.phase !== "done" || !state.analysis || state.swapsPending.length) return;
    // The references as they are now: swaps found after the analysis included.
    saveLastRun({ savedAt: Date.now(), text, presetId, cities, performer, analysis: { ...state.analysis, references: state.references }, accepted });
  }, [state.phase, state.analysis, state.references, state.swapsPending, accepted, text, presetId, cities, performer]);

  const reopen = (last: LastRun) => {
    setText(last.text);
    setPresetId(last.presetId);
    setCities(last.cities);
    setPerformer(last.performer);
    setAccepted(last.accepted);
    setSelectedKey(undefined);
    restore(last.analysis);
  };

  // A new reference starts at the top of the inspector, not where the last one was scrolled.
  useEffect(() => {
    inspectorBox.current?.scrollTo({ top: 0 });
  }, [activeKey]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(undefined), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  const start = () => {
    setAccepted({});
    setSelectedKey(undefined);
    setSheetOpen(false);
    window.scrollTo({ top: 0 });
    run({ text, presetId, cities, performerId: performer?.performer.id });
  };

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setText(s.text);
    // Someone who set up a performer's crowd and a tour wants to try the
    // example on it, not lose it.
    if (performer) return;
    setPresetId(s.presetId);
    setCities(s.cities);
  };

  if (state.phase === "idle" || !room) {
    return (
      <Composer
        text={text}
        onTextChange={setText}
        presetId={presetId}
        onPresetChange={setPresetId}
        performer={performer}
        onPerformerChange={setPerformer}
        cities={cities}
        onCitiesChange={setCities}
        onLoadSample={loadSample}
        onRun={start}
        lastRun={lastRun}
        onReopen={reopen}
      />
    );
  }

  const title = sample ? sample.title : "Your script";
  const running = state.phase === "running";
  const notes = {
    title,
    room: room.label,
    cities,
    references: refs,
    accepted,
    score,
    projected,
    hooks: state.hooks,
    revised: doc.revised,
    changed,
  };

  const copy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFlash(message);
    } catch {
      setFlash("Couldn't reach the clipboard");
    }
  };

  const inspector = (
    <Inspector
      reference={selected}
      index={Math.max(0, index)}
      total={refs.length}
      onStep={step}
      mix={room.ageMix}
      text={analysedText}
      accepted={selected ? accepted[selected.key] : undefined}
      onAccept={(i) => selected && accept(selected.key, i)}
      onUndo={() => selected && undo(selected.key)}
      rewrittenBy={rewrittenBy ? byKey.get(rewrittenBy)?.extracted.name : undefined}
      swapPending={selected ? state.swapsPending.includes(selected.key) : false}
    />
  );

  const scoreCard = <ScoreCard score={score} projected={projected} counts={shownCounts} progress={running ? progress : undefined} onJump={jump} />;
  const fixes = <FixesCard references={refs} accepted={accepted} selectedKey={activeKey} onSelect={select} />;

  return (
    <>
      <div className="flex flex-col gap-5 pt-4 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => {
                if (changed) setText(doc.revised);
                reset();
              }}
              className="mb-2 flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              {changed ? "Edit the revised script" : "Edit script"}
            </button>
            {sample && <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">{sample.format}</p>}
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {room.label}
              {cities.length > 0 && (
                <>
                  <span className="text-ink-faint"> in </span>
                  {cities.map((c) => c.split(",")[0]).join(", ")}
                </>
              )}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {flash && (
              <span role="status" className="flex items-center gap-1 text-sm text-lands-ink">
                <Check className="size-3.5" aria-hidden />
                {flash}
              </span>
            )}
            {changed && (
              <ToolbarButton icon={Copy} onClick={() => copy(doc.revised, "Revised script copied")}>
                Copy script
              </ToolbarButton>
            )}
            <ToolbarButton icon={FileText} onClick={() => copy(setNotes(notes), "Notes copied as Markdown")}>
              Copy notes
            </ToolbarButton>
            <ToolbarButton icon={Printer} onClick={() => window.print()}>
              Save PDF
            </ToolbarButton>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[250px_minmax(0,1fr)_380px]">
          <aside className="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:flex">
            {scoreCard}
            <div className="flex flex-col gap-4">
              {fixes}
              <div className="hidden xl:flex xl:flex-col xl:gap-4">
                <RoomCard room={room} cities={cities} />
                <AgentTrace statuses={state.statuses} running={running || state.swapsPending.length > 0} />
              </div>
            </div>
          </aside>

          <section className="card relative min-w-0 overflow-hidden rounded-3xl" aria-busy={running}>
            {running && (
              <div className="absolute inset-x-0 top-0 h-0.5 bg-line">
                <div
                  className="h-full bg-accent-glow transition-[width] duration-500"
                  style={{ width: `${progress.total ? Math.max(6, (progress.done / progress.total) * 100) : 6}%` }}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {title}
                {refs.length > 0 && ` · ${refs.length} references`}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                {VERDICT_ORDER.map((v) => (
                  <span key={v} className="flex items-center gap-1">
                    <VerdictIcon verdict={v} className="size-3" />
                    {VERDICT_LABEL[v]}
                  </span>
                ))}
                {changed && (
                  <label className="ml-1 flex cursor-pointer items-center gap-1.5 border-l border-line pl-3">
                    <input type="checkbox" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} className="accent-[var(--lands)]" />
                    Show changes
                  </label>
                )}
              </div>
            </div>
            {state.phase === "error" && (
              <div role="alert" className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-dead-tint px-4 py-3 text-sm text-dead-ink sm:mx-8">
                <p>{state.error}</p>
                <button
                  type="button"
                  onClick={start}
                  className="flex items-center gap-1.5 rounded-full border border-dead/40 px-3 py-1 text-xs font-medium hover:bg-dead/10"
                >
                  <RotateCw className="size-3.5" aria-hidden />
                  Try again
                </button>
              </div>
            )}
            <div className="px-5 py-6 sm:px-10 sm:py-9">
              {refs.length ? (
                <ScriptView pieces={doc.pieces} references={byKey} selectedKey={activeKey} onSelect={select} showChanges={showChanges} />
              ) : (
                <div>
                  {running && (
                    <p className="mb-4 inline-flex animate-shimmer items-center gap-2 rounded-full bg-sunk px-3 py-1 text-xs text-ink-soft">
                      Finding the references…
                    </p>
                  )}
                  <p className="whitespace-pre-wrap font-serif text-[17px] leading-[1.85] text-ink-faint sm:text-[18.5px]">{analysedText}</p>
                </div>
              )}
            </div>
          </section>

          <aside className="hidden lg:block">
            <div ref={inspectorBox} className="card sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl p-5 [scrollbar-width:thin] sm:p-6">
              {inspector}
            </div>
          </aside>
        </div>

        <GutVsData references={refs} room={room.audience} selectedKey={activeKey} onSelect={select} />
        <TourMatrix references={refs} selectedKey={activeKey} onSelect={select} />
        <LocalHooksPanel hooks={state.hooks} room={room.audience} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:hidden">
          <RoomCard room={room} cities={cities} />
          <AgentTrace statuses={state.statuses} running={running || state.swapsPending.length > 0} />
        </div>
      </div>

      {sheetOpen && selected && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label={selected.extracted.name}>
          <button type="button" aria-label="Close" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] animate-rise overflow-y-auto rounded-t-3xl border-t border-card-border bg-bg p-5 pb-8 shadow-2xl">
            <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-3 flex justify-center bg-bg pb-2 pt-3">
              <span className="h-1 w-10 rounded-full bg-line" aria-hidden />
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="absolute right-3 top-2 grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sunk">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {inspector}
          </div>
        </div>
      )}

      <Report {...notes} />
    </>
  );
}
