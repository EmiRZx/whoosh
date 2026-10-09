import { describe, expect, it } from "vitest";
import type { ExtractedReference } from "@/lib/analysis/extract";
import { buildReferences } from "@/lib/analysis/references";
import type { Swap } from "@/lib/analysis/types";
import { diffWords } from "./diff";
import { composeDocument, overlaps, planEdit } from "./document";
import { roomScore } from "./score";

const ref = (name: string, quotes: string[], weight: ExtractedReference["weight"] = "setup"): ExtractedReference => ({
  name,
  kind: "person",
  disambiguation: null,
  quotes,
  role: "test",
  weight,
  checkable: true,
});

const swap = (name: string, rewrite: string): Swap => ({
  entity: { id: name, name, type: "urn:entity:person" },
  signals: {},
  verdict: "lands",
  rewrite,
  why: "",
});

const apply = (a: string, parts: ReturnType<typeof diffWords>) =>
  [a, parts.filter((p) => p.kind !== "ins").map((p) => p.text).join(""), parts.filter((p) => p.kind !== "del").map((p) => p.text).join("")];

describe("diffWords", () => {
  it("replaces a multi-word name in one piece", () => {
    const a = 'Norah O\'Donnell left the briefing room to host "CBS This Morning."';
    const b = 'George Stephanopoulos left the briefing room to host "Good Morning America."';
    const parts = diffWords(a, b);
    expect(parts.slice(0, 2)).toEqual([
      { kind: "del", text: "Norah O'Donnell" },
      { kind: "ins", text: "George Stephanopoulos" },
    ]);
    expect(parts[2]).toEqual({ kind: "same", text: ' left the briefing room to host "' });
    // A one-word gap between changes is folded into a single change.
    expect(parts.slice(3, 5)).toEqual([
      { kind: "del", text: "CBS This Morning" },
      { kind: "ins", text: "Good Morning America" },
    ]);
    const [orig, before, after] = apply(a, parts);
    expect(before).toBe(orig);
    expect(after).toBe(b);
  });

  it("reconstructs both sides exactly", () => {
    const a = "Earn me some serious Tubmans. Really, serious ones.";
    const b = "Earn me some serious Hamiltons. Really, serious ones.";
    const [orig, before, after] = apply(a, diffWords(a, b));
    expect(before).toBe(orig);
    expect(after).toBe(b);
  });

  it("treats an unrelated sentence as a replacement", () => {
    const parts = diffWords("One thing here.", "Something else entirely different now.");
    expect(parts.map((p) => p.kind)).toEqual(["del", "ins"]);
  });
});

describe("composeDocument", () => {
  const text =
    'Even reporters have left me. Norah O\'Donnell left the briefing room to host "CBS This Morning." Jake Tapper left journalism to join CNN.';
  const refs = buildReferences(text, {
    references: [
      ref("Norah O'Donnell", ["Norah O'Donnell"]),
      ref("CBS This Morning", ["CBS This Morning"]),
      ref("Jake Tapper", ["Jake Tapper"]),
    ],
  });
  const norah = refs.find((r) => r.key === "norah-o-donnell")!;
  const edit = planEdit(
    text,
    norah,
    swap("George Stephanopoulos", 'George Stephanopoulos left the briefing room to host "Good Morning America."'),
  )!;

  it("applies the rewrite to the passage and nothing else", () => {
    const doc = composeDocument(text, refs, [edit]);
    expect(doc.revised).toBe(
      'Even reporters have left me. George Stephanopoulos left the briefing room to host "Good Morning America." Jake Tapper left journalism to join CNN.',
    );
    // The untouched reference keeps its highlight; the rewritten ones are gone.
    expect(doc.pieces.some((p) => p.kind === "text" && p.refKey === "jake-tapper")).toBe(true);
    expect([...doc.removed].sort()).toEqual(["cbs-this-morning", "norah-o-donnell"]);
    // Deleted text stays available for a tracked-changes view.
    expect(doc.pieces.find((p) => p.kind === "del" && p.refKey === "norah-o-donnell")?.text).toBe("Norah O'Donnell");
  });

  it("leaves the text alone without edits", () => {
    const doc = composeDocument(text, refs, []);
    expect(doc.revised).toBe(text);
    expect(doc.removed.size).toBe(0);
  });

  it("detects overlapping edits", () => {
    const cbs = refs.find((r) => r.key === "cbs-this-morning")!;
    const other = planEdit(text, cbs, swap("Today", 'Norah O\'Donnell left the briefing room to host "Today."'))!;
    expect(overlaps(edit, other)).toBe(true);
    const tapper = planEdit(text, refs.find((r) => r.key === "jake-tapper")!, swap("Anderson Cooper", "Anderson Cooper left journalism to join CNN."))!;
    expect(overlaps(edit, tapper)).toBe(false);
  });
});

describe("roomScore", () => {
  it("weights punchlines over color and counts risky as half", () => {
    expect(
      roomScore([
        { verdict: "lands", weight: "punchline" },
        { verdict: "dead", weight: "color" },
        { verdict: "risky", weight: "setup" },
        { verdict: "unchecked", weight: "punchline" },
      ]),
    ).toBeCloseTo((3 + 0 + 1) / 6);
  });

  it("is undefined before anything is measured", () => {
    expect(roomScore([{ verdict: "unchecked", weight: "setup" }])).toBeUndefined();
  });
});
