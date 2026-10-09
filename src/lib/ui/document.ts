// The script as the performer sees it after accepting swaps: the original text
// with each accepted rewrite applied as tracked changes, highlights kept for
// every reference the rewrite didn't touch.

import { passageAround, segmentText } from "@/lib/analysis/references";
import type { AnalyzedReference, Swap } from "@/lib/analysis/types";
import { diffWords, type DiffPart } from "./diff";

export interface Edit {
  refKey: string;
  // The passage the rewrite replaces, in original-text offsets.
  from: number;
  to: number;
  parts: DiffPart[];
}

export type Piece =
  | { kind: "text"; text: string; refKey?: string }
  | { kind: "del"; text: string; editKey: string; refKey?: string }
  | { kind: "ins"; text: string; editKey: string };

// Where a swap's rewrite goes: the passage the swap agent was given.
export function planEdit(text: string, ref: AnalyzedReference, swap: Swap): Edit | undefined {
  if (!ref.spans.length) return undefined;
  const passage = passageAround(text, ref.spans);
  const from = text.indexOf(passage);
  if (from < 0) return undefined;
  let rewrite = swap.rewrite.trim();
  // The passage starts after an opening quote that a rewrite may repeat.
  if (from > 0 && /["“]/.test(text[from - 1]) && /^["“]/.test(rewrite)) rewrite = rewrite.slice(1);
  return { refKey: ref.key, from, to: from + passage.length, parts: diffWords(passage, rewrite) };
}

export const overlaps = (a: { from: number; to: number }, b: { from: number; to: number }) =>
  a.from < b.to && b.from < a.to;

interface Hunk {
  start: number;
  end: number;
  insert: string;
  editKey: string;
}

function hunks(edit: Edit): Hunk[] {
  const out: Hunk[] = [];
  let cursor = edit.from;
  for (const part of edit.parts) {
    if (part.kind === "same") {
      cursor += part.text.length;
    } else if (part.kind === "del") {
      out.push({ start: cursor, end: cursor + part.text.length, insert: "", editKey: edit.refKey });
      cursor += part.text.length;
    } else {
      // An insertion right after a deletion replaces it; otherwise it stands alone.
      const last = out.at(-1);
      if (last && last.end === cursor && !last.insert) last.insert = part.text;
      else out.push({ start: cursor, end: cursor, insert: part.text, editKey: edit.refKey });
    }
  }
  return out;
}

export interface ComposedDocument {
  pieces: Piece[];
  // The script with every accepted swap applied.
  revised: string;
  // References whose every mention was rewritten away.
  removed: Set<string>;
}

export function composeDocument(text: string, references: AnalyzedReference[], edits: Edit[]): ComposedDocument {
  const all = edits.flatMap(hunks).sort((a, b) => a.start - b.start || a.end - b.end);
  const segments = segmentText(text, references);

  // Cut the text at every segment and hunk boundary, then label each run.
  const cuts = new Set<number>([0, text.length]);
  let offset = 0;
  const segStarts: { start: number; refKey?: string }[] = [];
  for (const seg of segments) {
    segStarts.push({ start: offset, refKey: seg.refKey });
    cuts.add(offset);
    offset += seg.text.length;
  }
  for (const h of all) {
    cuts.add(h.start);
    cuts.add(h.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const pieces: Piece[] = [];
  const push = (piece: Piece) => {
    const last = pieces.at(-1);
    const same =
      last &&
      last.kind === piece.kind &&
      ("refKey" in last ? last.refKey : undefined) === ("refKey" in piece ? piece.refKey : undefined) &&
      ("editKey" in last ? last.editKey : undefined) === ("editKey" in piece ? piece.editKey : undefined);
    if (same) last.text += piece.text;
    else pieces.push({ ...piece });
  };

  let seg = 0;
  const inserted = new Set<Hunk>();
  const emitInsertsAt = (pos: number) => {
    for (const h of all) {
      if (h.end === pos && h.insert && !inserted.has(h)) {
        inserted.add(h);
        push({ kind: "ins", text: h.insert, editKey: h.editKey });
      }
    }
  };

  for (let k = 0; k < points.length - 1; k++) {
    const p = points[k];
    const q = points[k + 1];
    emitInsertsAt(p);
    while (seg + 1 < segStarts.length && segStarts[seg + 1].start <= p) seg++;
    const refKey = segStarts[seg]?.refKey;
    const deleting = all.find((h) => h.start <= p && q <= h.end && h.start < h.end);
    const chunk = text.slice(p, q);
    if (deleting) push({ kind: "del", text: chunk, editKey: deleting.editKey, refKey });
    else push(refKey ? { kind: "text", text: chunk, refKey } : { kind: "text", text: chunk });
  }
  emitInsertsAt(text.length);

  // A reference is gone once every mention of it has been edited, even if a
  // word of it survives ("CBS This Morning" -> "Good Morning America").
  const removed = new Set<string>();
  for (const ref of references) {
    if (!ref.spans.length) continue;
    const gone = ref.spans.every((s) => all.some((h) => h.start < s.end && s.start < h.end));
    if (gone) removed.add(ref.key);
  }
  for (const piece of pieces) {
    if (piece.kind === "text" && piece.refKey && removed.has(piece.refKey)) delete piece.refKey;
  }

  const revised = pieces
    .filter((p) => p.kind !== "del")
    .map((p) => p.text)
    .join("");
  return { pieces, revised, removed };
}
