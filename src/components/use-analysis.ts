"use client";

import { useCallback, useRef, useState } from "react";
import type { Analysis, AnalysisEvent, AnalyzedReference, LocalHooks } from "@/lib/analysis/types";

export interface AnalysisRequest {
  text: string;
  presetId: string;
  cities: string[];
  performerId?: string;
}

export interface AnalysisState {
  phase: "idle" | "running" | "done" | "error";
  statuses: string[];
  references: AnalyzedReference[];
  hooks: LocalHooks[];
  analysis?: Analysis;
  error?: string;
  // References whose swap search is still running (one request each).
  swapsPending: string[];
}

const IDLE: AnalysisState = { phase: "idle", statuses: [], references: [], hooks: [], swapsPending: [] };

// Swap searches run two at a time; each can take a couple of minutes.
const SWAP_CONCURRENCY = 2;

function reduce(state: AnalysisState, event: AnalysisEvent): AnalysisState {
  switch (event.type) {
    case "status":
      return { ...state, statuses: [...state.statuses, event.message] };
    case "references":
      return { ...state, references: event.references };
    case "update":
      return {
        ...state,
        references: state.references.map((r) => (r.key === event.key ? { ...r, ...event.patch } : r)),
      };
    case "hooks":
      return { ...state, hooks: event.hooks };
    case "done":
      return {
        ...state,
        phase: "done",
        analysis: event.analysis,
        references: event.analysis.references,
        hooks: event.analysis.hooks ?? state.hooks,
      };
    case "error":
      return { ...state, phase: "error", error: event.message };
  }
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(IDLE);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async (request: AnalysisRequest) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState({ ...IDLE, phase: "running" });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `The request failed (${res.status}).`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished: Analysis | undefined;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line) as AnalysisEvent;
          if (event.type === "done") finished = event.analysis;
          setState((s) => reduce(s, event));
        }
      }
      // A stream that ends without "done" or "error" was cut off.
      setState((s) => (s.phase === "running" ? { ...s, phase: "error", error: "The connection closed early. Please try again." } : s));

      // Then the live swap searches, each in its own request.
      const targets = finished?.swapTargets ?? [];
      if (!finished || !targets.length) return;
      const refs = finished.references;
      const names = (key: string) => refs.filter((r) => r.key !== key).map((r) => r.extracted.name);
      setState((s) => ({
        ...s,
        swapsPending: targets,
        statuses: [...s.statuses, `Looking for swaps that do the same job for ${targets.map((k) => refs.find((r) => r.key === k)?.extracted.name).join(", ")}`],
      }));
      const queue = [...targets];
      await Promise.all(
        Array.from({ length: SWAP_CONCURRENCY }, async () => {
          for (let key = queue.shift(); key; key = queue.shift()) {
            const reference = refs.find((r) => r.key === key);
            let patch: Partial<AnalyzedReference>;
            try {
              const r = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...request, reference, others: names(key) }),
                signal: ctrl.signal,
              });
              const body = await r.json();
              patch = r.ok ? { swaps: body.swaps, swapNote: body.swapNote } : { swapNote: body.error ?? "The swap search failed." };
            } catch {
              if (ctrl.signal.aborted) return;
              patch = { swapNote: "The swap search didn't finish. Run the check again to retry." };
            }
            const done = key;
            setState((s) => ({ ...reduce(s, { type: "update", key: done, patch }), swapsPending: s.swapsPending.filter((k) => k !== done) }));
          }
        }),
      );
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setState((s) => ({ ...s, phase: "error", error: (err as Error).message }));
    }
  }, []);

  // Shows a finished analysis again without re-running it.
  const restore = useCallback((analysis: Analysis) => {
    controller.current?.abort();
    setState({ phase: "done", statuses: [], references: analysis.references, hooks: analysis.hooks ?? [], analysis, swapsPending: [] });
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    setState(IDLE);
  }, []);

  return { state, run, reset, restore };
}
