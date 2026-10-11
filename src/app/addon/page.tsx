import type { Metadata } from "next";
import { AddonPanel } from "@/components/addon/addon-panel";

export const metadata: Metadata = {
  title: "Whoosh for Google Docs",
  robots: { index: false },
};

// Google Docs has no dark mode, so the panel stays light to match the page beside it.
const LIGHT = `document.documentElement.setAttribute("data-theme","light")`;

export default function AddonPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: LIGHT }} />
      <main className="min-h-full bg-bg">
        <AddonPanel />
      </main>
    </>
  );
}
