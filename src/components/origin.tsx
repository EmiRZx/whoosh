"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// This site's own address, once the page is in the browser.
export function Origin({ fallback }: { fallback: string }) {
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => fallback,
  );
  return <>{origin}</>;
}
