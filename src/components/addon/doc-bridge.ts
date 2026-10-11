"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The add-on's sidebar (addons/google-docs/Sidebar.html) frames this page and
// relays calls to Code.gs. Google serves the sidebar from a googleusercontent.com
// sandbox; in development a local harness stands in for it.
const PARENT =
  process.env.NODE_ENV === "production"
    ? /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com$/
    : /^(https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com|http:\/\/localhost:\d+)$/;

export type DocMethod = "getScript" | "insertExample" | "paint" | "clear" | "select" | "apply";
export type BridgeState = "connecting" | "connected" | "outside";

export interface DocScript {
  text: string;
  // Where the text starts in the document.
  base: number;
  selection: boolean;
}

interface Waiting {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useDocBridge() {
  const [state, setState] = useState<BridgeState>("connecting");
  const parent = useRef<string | null>(null);
  const waiting = useRef(new Map<number, Waiting>());
  const nextId = useRef(1);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const pending = waiting.current;
    const onMessage = (e: MessageEvent) => {
      if (window.parent === window || e.source !== window.parent || !PARENT.test(e.origin)) return;
      const m = e.data;
      if (!m || m.whoosh !== 1) return;
      if (m.type === "hello") {
        parent.current = e.origin;
        setState("connected");
        return;
      }
      if (m.type !== "result" || e.origin !== parent.current) return;
      const w = pending.get(m.id);
      if (!w) return;
      pending.delete(m.id);
      clearTimeout(w.timer);
      if (m.error) w.reject(new Error(m.error));
      else w.resolve(m.result);
    };
    window.addEventListener("message", onMessage);
    // Knock until the sidebar answers; outside a frame nobody will. The knock
    // carries no data, so it can go to any origin.
    let tries = 0;
    const timer = setInterval(() => {
      if (parent.current) return clearInterval(timer);
      if (window.parent === window || ++tries > 40) {
        clearInterval(timer);
        setState("outside");
        return;
      }
      window.parent.postMessage({ whoosh: 1, type: "ready" }, "*");
    }, 150);
    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
      for (const w of pending.values()) clearTimeout(w.timer);
      pending.clear();
    };
  }, []);

  const call = useCallback(<T = unknown>(method: DocMethod, arg?: unknown): Promise<T> => {
    const send = () =>
      new Promise<T>((resolve, reject) => {
        const origin = parent.current;
        if (!origin) return reject(new Error("Not connected to Google Docs. Close the sidebar and open it again."));
        const id = nextId.current++;
        const timer = setTimeout(() => {
          waiting.current.delete(id);
          reject(new Error("Google Docs didn't answer. Try again."));
        }, 45_000);
        waiting.current.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
        window.parent.postMessage({ whoosh: 1, type: "call", id, method, arg }, origin);
      });
    // One call at a time, so a later paint never lands before an earlier one.
    const result = queue.current.then(send, send);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  return { state, call };
}
