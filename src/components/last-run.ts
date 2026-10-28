"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Analysis } from "@/lib/analysis/types";
import type { PerformerRoomData } from "./performer-picker";

// The visitor's last finished check, kept in their own browser so leaving or
// reloading the page doesn't throw away a run they waited (and paid) for.
const KEY = "whoosh-last-run";
const CHANGED = "whoosh-last-run-changed";

export interface LastRun {
  savedAt: number;
  text: string;
  presetId: string;
  cities: string[];
  performer?: PerformerRoomData;
  analysis: Analysis;
  accepted: Record<string, number>;
}

export function saveLastRun(run: LastRun) {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
    window.dispatchEvent(new Event(CHANGED));
  } catch {}
}

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
};

export const hasLastRun = () => !!read();

export function useLastRun(): LastRun | undefined {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => {
    if (!raw) return undefined;
    try {
      const run = JSON.parse(raw) as LastRun;
      return run.analysis?.references ? run : undefined;
    } catch {
      return undefined;
    }
  }, [raw]);
}
