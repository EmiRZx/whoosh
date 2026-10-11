import { describe, expect, it } from "vitest";
import type { ExtractedReference } from "@/lib/analysis/extract";
import { buildReferences } from "@/lib/analysis/references";
import type { AnalyzedReference, Swap } from "@/lib/analysis/types";
import { DOC_COLOR, docChange, docMarks, reverseChange } from "@/lib/ui/doc-ops";
import { planEdit } from "@/lib/ui/document";
import { FakeDoc, FakeParagraph, loadAddon } from "./fake-docs";

const extracted = (name: string, quotes: string[]): ExtractedReference => ({
  name,
  kind: "brand",
  disambiguation: null,
  quotes,
  role: "test",
  weight: "punchline",
  checkable: true,
});

const swap = (name: string, rewrite: string): Swap => ({
  entity: { id: name, name, type: "urn:entity:brand" },
  signals: {},
  verdict: "lands",
  rewrite,
  why: "",
});

const YELLOW = "#ffff00";

describe("Code.gs", () => {
  it("reads the document as paragraphs joined by newlines", () => {
    const doc = new FakeDoc(["Title", "", "We met at Sizzler.\rIt was fine."]);
    expect(loadAddon(doc).getScript()).toEqual({ text: "Title\n\nWe met at Sizzler.\nIt was fine.", base: 0, selection: false });
  });

  it("reads the selection with its place in the document", () => {
    const doc = new FakeDoc(["Intro line.", "We met at Sizzler.", "The end."]);
    doc.selection = {
      getRangeElements: () => [
        { getElement: () => doc.paragraphs[1].getChild(0), isPartial: () => true, getStartOffset: () => 3, getEndOffsetInclusive: () => 17 },
        { getElement: () => doc.paragraphs[2], isPartial: () => false, getStartOffset: () => -1, getEndOffsetInclusive: () => -1 },
      ],
    };
    expect(loadAddon(doc).getScript()).toEqual({ text: "met at Sizzler.\nThe end.", base: 15, selection: true });
  });

  it("marks the occurrence nearest the hint and clears only its own colors", () => {
    const doc = new FakeDoc(["Friends at Friends.", "Mine stays."]);
    doc.paragraphs[1].editAsText().setBackgroundColor(0, 3, YELLOW);
    const addon = loadAddon(doc);
    expect(addon.paint([{ quote: "Friends", at: 12, color: DOC_COLOR.dead }])).toBe(1);
    expect(doc.paragraphs[0].marked()).toBe(`Friends at [${DOC_COLOR.dead}:Friends].`);
    // A new paint replaces the old marks.
    addon.paint([{ quote: "Friends", at: 0, color: DOC_COLOR.lands }]);
    expect(doc.paragraphs[0].marked()).toBe(`[${DOC_COLOR.lands}:Friends] at Friends.`);
    addon.clear();
    expect(doc.paragraphs[0].marked()).toBe("Friends at Friends.");
    expect(doc.paragraphs[1].marked()).toBe(`[${YELLOW}:Mine] stays.`);
  });

  it("selects inside the right text element", () => {
    // "Go to " is a link, so the paragraph has two text elements.
    const doc = new FakeDoc(["First.", new FakeParagraph("Go to Sizzler now.", [6])]);
    expect(loadAddon(doc).select({ quote: "Sizzler", at: 13 })).toBe(true);
    expect(doc.selected).toEqual({ text: "Sizzler now.", start: 0, end: 6 });
  });

  it("fills an empty document with an example, and refuses a document with text", () => {
    const doc = new FakeDoc([""]);
    loadAddon(doc).insertExample("One.\n\nTwo.");
    expect(doc.text()).toBe("One.\n\nTwo.");
    expect(() => loadAddon(doc).insertExample("Three.")).toThrow(/already has text/);
  });
});

describe("a swap, end to end", () => {
  const lines = ["Our first date was at Sizzler, of all places.", "He ordered for both of us at Sizzler."];
  // The swap agent rewrites every sentence that mentions the reference.
  const rewrite = "Our first date was at Olive Garden, of all places.\nHe ordered for both of us at Olive Garden.";
  const setup = () => {
    const doc = new FakeDoc(["", ...lines]);
    const addon = loadAddon(doc);
    const script = addon.getScript();
    // The server trims the script; offsets are into the trimmed text.
    const text = script.text.trim();
    const base = script.base + (script.text.length - script.text.trimStart().length);
    const refs: AnalyzedReference[] = buildReferences(text, { references: [extracted("Sizzler", ["Sizzler", "Sizzler"])] }).map((r) => ({
      ...r,
      verdict: "dead",
      resolution: { status: "resolved" },
    }));
    return { doc, addon, text, base, ref: refs[0] };
  };

  it("marks every mention, then rewrites the lines in place", () => {
    const { doc, addon, text, base, ref } = setup();
    expect(addon.paint(docMarks(text, [ref], base))).toBe(2);
    const change = docChange(planEdit(text, ref, swap("Olive Garden", rewrite))!, base, DOC_COLOR.lands);
    // The writer has typed above the lines since the check.
    doc.paragraphs[0].setText("Draft 2");
    expect(addon.apply(change)).toBe(true);
    // Only the changed words are touched, so the writer's own formatting survives.
    expect(doc.paragraphs[1].marked()).toBe(`Our first date was at [${DOC_COLOR.lands}:Olive Garden], of all places.`);
    expect(doc.paragraphs[2].marked()).toBe(`He ordered for both of us at [${DOC_COLOR.lands}:Olive Garden].`);

    expect(addon.apply(reverseChange(change, DOC_COLOR.dead))).toBe(true);
    expect(doc.paragraphs[1].marked()).toBe(`Our first date was at [${DOC_COLOR.dead}:Sizzler], of all places.`);
    expect(doc.paragraphs[2].marked()).toBe(`He ordered for both of us at [${DOC_COLOR.dead}:Sizzler].`);
  });

  it("refuses a line that has changed, and a change across paragraphs", () => {
    const { doc, addon, text, base, ref } = setup();
    const merged = docChange(planEdit(text, ref, swap("Olive Garden", rewrite.replace("\n", " ")))!, base);
    expect(() => addon.apply(merged)).toThrow(/spans two paragraphs/);
    doc.paragraphs[1].setText("Our first date was somewhere else.");
    expect(() => addon.apply(docChange(planEdit(text, ref, swap("Olive Garden", rewrite))!, base))).toThrow(/changed since the check/);
  });
});
