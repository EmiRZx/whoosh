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
}

const IDLE: AnalysisState = { phase: "idle", statuses: [], references: [], hooks: [] };

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
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) setState((s) => reduce(s, JSON.parse(line) as AnalysisEvent));
        }
      }
      // A stream that ends without "done" or "error" was cut off.
      setState((s) => (s.phase === "running" ? { ...s, phase: "error", error: "The connection closed early. Please try again." } : s));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setState((s) => ({ ...s, phase: "error", error: (err as Error).message }));
    }
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    setState(IDLE);
  }, []);

  return { state, run, reset };
}
