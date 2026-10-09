import { locateQuotes, type Extraction } from "./extract";
import type { AnalyzedReference } from "./types";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Turns an extraction into references with highlight spans. Punchlines claim
// their quotes first, so when two references share a word the one the joke
// depends on keeps the highlight.
export function buildReferences(text: string, extraction: Extraction): AnalyzedReference[] {
  const order = { punchline: 0, setup: 1, color: 2 } as const;
  const taken = new Set<number>();
  const keys = new Set<string>();

  const built = [...extraction.references]
    .map((ref, index) => ({ ref, index }))
    .sort((a, b) => order[a.ref.weight] - order[b.ref.weight] || a.index - b.index)
    .map(({ ref, index }) => {
      let key = slug(ref.name) || `ref-${index}`;
      while (keys.has(key)) key += "-x";
      keys.add(key);
      return {
        index,
        reference: {
          key,
          extracted: ref,
          spans: locateQuotes(text, ref.quotes, taken).spans,
          resolution: { status: ref.checkable ? "pending" : "not_checkable" },
          verdict: "unchecked",
          reasons: [],
          swaps: [],
        } satisfies AnalyzedReference,
      };
    });

  // Back to reading order: first appearance in the text.
  const firstSpan = (r: AnalyzedReference) => r.spans[0]?.start ?? Number.MAX_SAFE_INTEGER;
  return built.map((b) => b.reference).sort((a, b) => firstSpan(a) - firstSpan(b));
}

// The sentence (or two, for short ones) around a span: what the swap agent
// rewrites.
export function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  // The last sentence end before the span, counting one inside a closing
  // quote ('..."CBS This Morning." Jake Tapper').
  let from = before.lastIndexOf("\n");
  for (const m of before.matchAll(/[.?!]["”'’)]*\s/g)) from = Math.max(from, m.index + m[0].length - 1);
  const after = text.slice(end).search(/[.?!](\s|["”'’)]|$)/);
  let to = after < 0 ? text.length : end + after + 1;
  // Keep a closing quote or bracket that ends the sentence.
  while (to < text.length && /["”'’)]/.test(text[to])) to++;
  return text
    .slice(from < 0 ? 0 : from + 1, to)
    .replace(/^["\s]+/, "")
    .trim();
}

// Every sentence that mentions the reference, joined, so a rewrite can reach
// all of its mentions ("Who Wants to Be a Millionaire" ... "50:50 lifeline").
// Falls back to the first sentence when the mentions are far apart.
export function passageAround(text: string, spans: { start: number; end: number }[], maxLength = 500): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const first = sentenceAround(text, sorted[0].start, sorted[0].end);
  const last = sorted.at(-1)!;
  const from = text.indexOf(first);
  const lastSentence = sentenceAround(text, last.start, last.end);
  const to = text.indexOf(lastSentence, from) + lastSentence.length;
  const passage = from >= 0 && to > from ? text.slice(from, to).trim() : first;
  return passage.length <= maxLength ? passage : first;
}

// The paragraph around a span, for context the line itself doesn't carry
// (the next sentence may explain the joke).
export function paragraphAround(text: string, start: number): string {
  const from = text.lastIndexOf("\n\n", start);
  const to = text.indexOf("\n\n", start);
  return text.slice(from < 0 ? 0 : from + 2, to < 0 ? text.length : to).trim();
}

export interface Segment {
  text: string;
  refKey?: string;
}

// Splits the text into plain and highlighted runs for rendering.
export function segmentText(text: string, references: AnalyzedReference[]): Segment[] {
  const spans = references
    .flatMap((r) => r.spans.map((s) => ({ ...s, key: r.key })))
    .sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // overlap: the earlier span wins
    if (span.start > cursor) segments.push({ text: text.slice(cursor, span.start) });
    segments.push({ text: text.slice(span.start, span.end), refKey: span.key });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
