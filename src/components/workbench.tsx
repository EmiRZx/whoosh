"use client";

import { useMemo, useState } from "react";
import { SAMPLES } from "@/content/samples";
import { presetById } from "@/lib/audience/audience";
import type { Verdict } from "@/lib/analysis/types";
import { Inspector, VerdictChip } from "./inspector";
import { LocalHooksPanel } from "./local-hooks";
import { AgeBar, RoomPicker } from "./room-picker";
import { ScriptView } from "./script-view";
import { useAnalysis } from "./use-analysis";

const MAX_CHARS = 8000;
const VERDICT_ORDER: Verdict[] = ["lands", "risky", "dead", "unchecked"];

export function Workbench() {
  const [text, setText] = useState("");
  const [presetId, setPresetId] = useState("comedy-club");
  const [cities, setCities] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const { state, run, reset } = useAnalysis();

  const loadSample = (id: string) => {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setText(sample.text);
    setPresetId(sample.presetId);
    setCities(sample.cities);
  };

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { lands: 0, risky: 0, dead: 0, unchecked: 0 };
    for (const r of state.references) c[r.verdict]++;
    return c;
  }, [state.references]);

  // Until the user picks one, show the first punchline so the inspector isn't empty.
  const activeKey = state.references.some((r) => r.key === selectedKey)
    ? selectedKey
    : (state.references.find((r) => r.extracted.weight === "punchline") ?? state.references[0])?.key;

  if (state.phase === "idle") {
    const canRun = text.trim().length > 0 && text.length <= MAX_CHARS;
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-[0_24px_48px_-32px_rgba(30,27,22,0.45)] sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Try an example</span>
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s.id)}
                className="rounded-full border border-rule px-3 py-1 text-xs transition-colors hover:border-ink hover:bg-paper"
              >
                <span className="font-medium">{s.format}</span>
                <span className="text-ink-soft"> · {s.title}</span>
              </button>
            ))}
          </div>
          <label htmlFor="script" className="sr-only">
            Your script
          </label>
          <textarea
            id="script"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your script goes here: a tight five, a best man speech, a lecture, a keynote. Every name in it gets measured against the room."
            className="ruled min-h-[24rem] w-full resize-y bg-transparent font-script text-[15px] leading-8 outline-none placeholder:text-ink-faint sm:text-base"
          />
          <p className={`mt-2 text-right text-xs ${text.length > MAX_CHARS ? "text-dead-ink" : "text-ink-faint"}`}>
            {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </p>
        </section>

        <aside className="flex flex-col gap-6 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <RoomPicker presetId={presetId} onPresetChange={setPresetId} cities={cities} onCitiesChange={setCities} />
          <button
            type="button"
            disabled={!canRun}
            onClick={() => run({ text, presetId, cities })}
            className="mt-auto rounded-xl bg-ink px-5 py-3.5 text-base font-semibold text-paper transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Check the room
          </button>
        </aside>
      </div>
    );
  }

  const preset = presetById(presetId);
  const selected = state.references.find((r) => r.key === activeKey);
  const analysedText = state.analysis?.text ?? text.replace(/\r\n/g, "\n").trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rule bg-paper-raised px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-medium">{preset?.label}</span>
          {preset && <AgeBar mix={preset.ageMix} className="w-24" />}
          {cities.length > 0 && <span className="text-ink-soft">{cities.join(" · ")}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {VERDICT_ORDER.filter((v) => counts[v] > 0).map((v) => (
            <span key={v} className="flex items-center gap-1 text-sm">
              <VerdictChip verdict={v} />
              <span className="tabular-nums text-ink-soft">{counts[v]}</span>
            </span>
          ))}
          <button
            type="button"
            onClick={reset}
            className="ml-2 rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink"
          >
            Edit script
          </button>
        </div>
      </div>

      {state.phase === "error" && (
        <p role="alert" className="rounded-xl border border-dead-ink/30 bg-dead/40 px-4 py-3 text-sm text-dead-ink">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-rule bg-paper-raised p-5 sm:p-7" aria-busy={state.phase === "running"}>
          {state.references.length ? (
            <ScriptView text={analysedText} references={state.references} selectedKey={activeKey} onSelect={setSelectedKey} />
          ) : (
            <p className="ruled whitespace-pre-wrap font-script text-[15px] leading-8 text-ink-faint">{analysedText}</p>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-rule bg-paper-raised p-5 lg:sticky lg:top-4">
            <Inspector reference={selected} />
          </div>
          <ol className="flex flex-col gap-1 rounded-2xl bg-stage px-5 py-4 font-script text-xs text-stage-ink-soft" aria-live="polite" aria-label="What the agent is doing">
            {state.statuses.map((s, i) => (
              <li key={i} className={i === state.statuses.length - 1 && state.phase === "running" ? "text-spot" : undefined}>
                {s}
              </li>
            ))}
            {state.phase === "running" && state.statuses.length === 0 && <li className="text-spot">Starting…</li>}
          </ol>
        </aside>
      </div>

      {preset && <LocalHooksPanel hooks={state.hooks} room={preset.label} />}
    </div>
  );
}
