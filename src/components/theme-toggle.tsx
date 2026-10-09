"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect } from "react";

const KEY = "whoosh-theme";

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Both icons render and CSS shows the one for the other theme, so the server
// HTML never disagrees with the theme the inline script picked.
export function ThemeToggle() {
  // React's dev remount clears attributes on <html>; put the theme back.
  useLayoutEffect(() => {
    const theme = stored();
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, []);

  const toggle = () => {
    const current =
      document.documentElement.getAttribute("data-theme") ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark"
      title="Switch between light and dark"
      className="grid size-9 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:text-ink"
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}
