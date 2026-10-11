// A small stand-in for Apps Script's DocumentApp, enough to run Code.gs in
// tests: paragraphs of characters with a background color each, split into
// text elements the way links and inline images split real paragraphs.

import fs from "node:fs";
import path from "node:path";

interface Char {
  c: string;
  bg: string | null;
}

class FakeText {
  constructor(
    private para: FakeParagraph,
    private from = 0,
    private to?: number,
  ) {}
  private get chars() {
    return this.para.chars.slice(this.from, this.to ?? this.para.chars.length);
  }
  getType() {
    return "TEXT";
  }
  asText() {
    return this;
  }
  editAsText() {
    return this;
  }
  getText() {
    return this.chars.map((x) => x.c).join("");
  }
  getBackgroundColor(offset: number) {
    return this.para.chars[this.from + offset].bg;
  }
  setBackgroundColor(start: number, endInclusive: number, color: string | null) {
    if (start < 0 || endInclusive >= this.chars.length || endInclusive < start) throw new Error(`bad range ${start}-${endInclusive}`);
    for (let i = start; i <= endInclusive; i++) this.para.chars[this.from + i].bg = color;
  }
  getTextAttributeIndices() {
    const out: number[] = [];
    this.chars.forEach((x, i) => {
      if (i === 0 || x.bg !== this.chars[i - 1].bg) out.push(i);
    });
    return out;
  }
  deleteText(start: number, endInclusive: number) {
    if (start < 0 || endInclusive >= this.chars.length || endInclusive < start) throw new Error(`bad delete ${start}-${endInclusive}`);
    this.para.chars.splice(this.from + start, endInclusive - start + 1);
  }
  insertText(offset: number, text: string) {
    if (offset < 0 || offset >= this.chars.length) throw new Error(`bad insert at ${offset}`);
    // New text takes the formatting of the character before it.
    const bg = offset > 0 ? this.para.chars[this.from + offset - 1].bg : this.para.chars[this.from].bg;
    this.para.chars.splice(this.from + offset, 0, ...[...text].map((c) => ({ c, bg })));
  }
  appendText(text: string) {
    const bg = this.para.chars.at(-1)?.bg ?? null;
    this.para.chars.push(...[...text].map((c) => ({ c, bg })));
  }
}

export class FakeParagraph {
  chars: Char[];
  // Where each text element after the first starts.
  splits: number[];
  constructor(text: string, splits: number[] = []) {
    this.chars = [...text].map((c) => ({ c, bg: null }));
    this.splits = splits;
  }
  getType() {
    return "PARAGRAPH";
  }
  getText() {
    return this.chars.map((x) => x.c).join("");
  }
  setText(text: string) {
    this.chars = [...text].map((c) => ({ c, bg: null }));
    this.splits = [];
  }
  editAsText() {
    return new FakeText(this);
  }
  getNumChildren() {
    return this.chars.length ? this.splits.length + 1 : 0;
  }
  getChild(i: number) {
    const bounds = [0, ...this.splits, this.chars.length];
    return new FakeText(this, bounds[i], bounds[i + 1]);
  }
  // Characters with their background, "[" and "]" around colored runs.
  marked() {
    let out = "";
    this.chars.forEach((x, i) => {
      const prev = i > 0 ? this.chars[i - 1].bg : null;
      if (x.bg !== prev) out += prev ? (x.bg ? `][${x.bg}:` : "]") : `[${x.bg}:`;
      out += x.c;
    });
    if (this.chars.at(-1)?.bg) out += "]";
    return out;
  }
}

interface Range {
  getRangeElements(): { getElement(): unknown; isPartial(): boolean; getStartOffset(): number; getEndOffsetInclusive(): number }[];
}

export class FakeDoc {
  paragraphs: FakeParagraph[];
  selection: Range | null = null;
  selected?: { text: string; start: number; end: number };
  constructor(lines: (string | FakeParagraph)[]) {
    this.paragraphs = lines.map((l) => (typeof l === "string" ? new FakeParagraph(l) : l));
  }
  getBody() {
    return {
      getParagraphs: () => this.paragraphs,
      appendParagraph: (text: string) => {
        const p = new FakeParagraph(text);
        this.paragraphs.push(p);
        return p;
      },
      clear: () => {
        this.paragraphs = [new FakeParagraph("")];
      },
    };
  }
  getSelection() {
    return this.selection;
  }
  newRange() {
    let picked: { text: string; start: number; end: number } | undefined;
    const builder = {
      addElement: (el: FakeText, start: number, end: number) => {
        picked = { text: el.getText(), start, end };
        return builder;
      },
      build: () => picked,
    };
    return builder;
  }
  setSelection(range: { text: string; start: number; end: number }) {
    this.selected = range;
  }
  text() {
    return this.paragraphs.map((p) => p.getText()).join("\n");
  }
}

export interface AddonCode {
  getScript(): { text: string; base: number; selection: boolean };
  insertExample(text: string): boolean;
  paint(marks: { quote: string; at: number; color: string }[]): number;
  clear(): boolean;
  select(mark: { quote: string; at: number }): boolean;
  apply(change: { before: string; at: number; ops: { at: number; remove: number; insert: string }[]; color?: string }): boolean;
}

// Loads Code.gs against a fake document.
export function loadAddon(doc: FakeDoc): AddonCode {
  const source = fs.readFileSync(path.join(import.meta.dirname, "Code.gs"), "utf8");
  const DocumentApp = { getActiveDocument: () => doc, ElementType: { TEXT: "TEXT", PARAGRAPH: "PARAGRAPH" } };
  const factory = new Function("DocumentApp", `${source}\nreturn { getScript, insertExample, paint, clear, select, apply };`);
  return factory(DocumentApp);
}
