"use client";

import { ArrowLeft, Check, Copy, FileText, Printer, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AgentTrace, FixesCard, RoomCard, ScoreCard, VERDICT_ORDER } from "./summary";
import { TourMatrix } from "./tour-matrix";
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
  const [presetId, setPresetId] = useState("comedy-club");
  const [cities, setCities] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [accepted, setAccepted] = useState<Record<string, number>>({});
  const [showChanges, setShowChanges] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flash, setFlash] = useState<string>();
  const { state, run, reset } = useAnalysis();

  const sample = SAMPLES.find((s) => s.text === text);
  const preset = presetById(presetId);
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
    for (const r of refs) c[r.verdict]++;
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
    run({ text, presetId, cities });
  };

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setText(s.text);
    setPresetId(s.presetId);
    setCities(s.cities);
  };

  if (state.phase === "idle" || !preset) {
    return (
      <Composer
        text={text}
        onTextChange={setText}
        presetId={presetId}
        onPresetChange={setPresetId}
        cities={cities}
        onCitiesChange={setCities}
        onLoadSample={loadSample}
        onRun={start}
      />
    );
  }

  const title = sample ? sample.title : "Your script";
  const running = state.phase === "running";
  const notes = {
    title,
    room: preset.label,
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
      mix={preset.ageMix}
      text={analysedText}
      accepted={selected ? accepted[selected.key] : undefined}
      onAccept={(i) => selected && accept(selected.key, i)}
      onUndo={() => selected && undo(selected.key)}
      rewrittenBy={rewrittenBy ? byKey.get(rewrittenBy)?.extracted.name : undefined}
    />
  );

  const scoreCard = <ScoreCard score={score} projected={projected} counts={counts} progress={running ? progress : undefined} onJump={jump} />;
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
              {preset.label}
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
                <RoomCard preset={preset} cities={cities} />
                <AgentTrace statuses={state.statuses} running={running} />
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
              <p role="alert" className="mx-5 mt-5 rounded-xl bg-dead-tint px-4 py-3 text-sm text-dead-ink sm:mx-8">
                {state.error}
              </p>
            )}
            <div className="px-5 py-6 sm:px-10 sm:py-9">
              {refs.length ? (
                <ScriptView pieces={doc.pieces} references={byKey} selectedKey={activeKey} onSelect={select} showChanges={showChanges} />
              ) : (
                <div className="relative">
                  <p className="whitespace-pre-wrap font-serif text-[17px] leading-[1.85] text-ink-faint sm:text-[18.5px]">{analysedText}</p>
                  {running && (
                    <p className="absolute left-0 top-0 flex animate-shimmer items-center gap-2 rounded-full bg-card px-3 py-1 text-xs text-ink-soft ring-1 ring-line">
                      Finding the references…
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="card scrollbar-none sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl p-5 sm:p-6">{inspector}</div>
          </aside>
        </div>

        <GutVsData references={refs} room={preset.label} selectedKey={activeKey} onSelect={select} />
        <TourMatrix references={refs} selectedKey={activeKey} onSelect={select} />
        <LocalHooksPanel hooks={state.hooks} room={preset.label} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:hidden">
          <RoomCard preset={preset} cities={cities} />
          <AgentTrace statuses={state.statuses} running={running} />
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
