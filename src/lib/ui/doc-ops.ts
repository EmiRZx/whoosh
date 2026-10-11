// What the Google Docs add-on asks the document to do. The add-on addresses
// text by content plus a position hint (where it was when the script was sent),
// so marks and swaps still find their words after the writer has typed
// elsewhere in the document. addons/google-docs/Code.gs carries these out.

import type { AnalyzedReference, Verdict } from "@/lib/analysis/types";
import { diffWords, type DiffPart } from "./diff";
import type { Edit } from "./document";

// Opaque tints of the status colors, so a highlight reads on white paper.
// Code.gs clears exactly these colors; keep the two lists in step.
export const DOC_COLOR: Record<Verdict | "pending", string> = {
  lands: "#cfedcf",
  risky: "#fde4ad",
  dead: "#f4cfcf",
  unchecked: "#e4e4e1",
  pending: "#efefed",
};

export interface DocMark {
  quote: string;
  at: number;
  color: string;
}

export interface DocOp {
  // Offset in the passage.
  at: number;
  remove: number;
  insert: string;
}

export interface DocChange {
  before: string;
  after: string;
  // Where the passage started in the document.
  at: number;
  ops: DocOp[];
  color?: string;
}

const markColor = (r: AnalyzedReference) => DOC_COLOR[r.resolution.status === "pending" ? "pending" : r.verdict];

// One mark per highlighted mention. `base` is where the analysed text starts
// in the document; `skip` holds references whose words a swap replaced.
export function docMarks(text: string, references: AnalyzedReference[], base: number, skip: Set<string> = new Set()): DocMark[] {
  return references
    .filter((r) => !skip.has(r.key))
    .flatMap((r) => r.spans.map((s) => ({ quote: text.slice(s.start, s.end), at: base + s.start, color: markColor(r) })));
}

// Changes with their surrounding words left alone, so formatting survives.
export function opsFromParts(parts: DiffPart[]): DocOp[] {
  const ops: DocOp[] = [];
  let cursor = 0;
  for (const part of parts) {
    if (part.kind === "same") {
      cursor += part.text.length;
    } else if (part.kind === "del") {
      ops.push({ at: cursor, remove: part.text.length, insert: "" });
      cursor += part.text.length;
    } else {
      // An insertion right after a deletion replaces it.
      const last = ops.at(-1);
      if (last && last.at + last.remove === cursor && !last.insert) last.insert = part.text;
      else ops.push({ at: cursor, remove: 0, insert: part.text });
    }
  }
  return ops;
}

const side = (parts: DiffPart[], drop: DiffPart["kind"]) =>
  parts
    .filter((p) => p.kind !== drop)
    .map((p) => p.text)
    .join("");

export function docChange(edit: Edit, base: number, color?: string): DocChange {
  return { before: side(edit.parts, "ins"), after: side(edit.parts, "del"), at: base + edit.from, ops: opsFromParts(edit.parts), color };
}

// Puts the original words back.
export function reverseChange(change: DocChange, color?: string): DocChange {
  return { before: change.after, after: change.before, at: change.at, ops: opsFromParts(diffWords(change.after, change.before)), color };
}
